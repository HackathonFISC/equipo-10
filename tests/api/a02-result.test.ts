import { describe, it, expect } from 'bun:test';
import { getProfileProposalIssues } from '@equipo10/contracts';
import { AgentA02Service, type AgentA02Input } from '../../apps/api/src/modules/profile/agent-a02.service';
import type { VertexConfig } from '../../apps/api/src/modules/profile/vertex-auth';

const input: AgentA02Input = {
  runId: crypto.randomUUID(), goal: 'build_profile',
  draft: { id: crypto.randomUUID(), profile_id: crypto.randomUUID(), base_version_id: null,
    revision: 1, status: 'DRAFT', version_number: null, display_name: 'Prueba', headline: null,
    experience_status: 'UNKNOWN', training_status: 'UNKNOWN', interests_status: 'UNKNOWN',
    experiences: [], trainings: [], interests: [], windows: [], constraints: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  fragments: [{ id: crypto.randomUUID(), text: 'Ayudaba en la tienda familiar.', page: 1, start_millis: null, end_millis: null }],
};
const config: VertexConfig = { projectId: 'test', location: 'global', model: 'gemini-3.8-flash', accessToken: 'test-only' };
const call = (name: string, args = {}) => ({ functionCall: { name, args } });

async function simulate(finalArgs: object | null, finishReason: string | string[] = 'STOP') {
  const original = globalThis.fetch;
  const requests: any[] = [];
  globalThis.fetch = Object.assign(async (url: any, init: any) => {
    requests.push({ url, body: JSON.parse(init.body), signal: init.signal });
    const parts = requests.length === 1
      ? [call('read_profile_draft'), call('read_source_fragments')]
      : finalArgs ? [call('save_profile_proposals', finalArgs)] : [call('read_source_fragments')];
    const reason = Array.isArray(finishReason) ? finishReason[requests.length - 2] : finishReason;
    return Response.json({ candidates: [{ content: { parts }, finishReason: requests.length === 1 ? 'STOP' : reason }] });
  }, { preconnect: original.preconnect }) as typeof fetch;
  try {
    // Exercise the provider loop with HTTP fixtures, without ADC or cloud charges.
    const service = new AgentA02Service() as unknown as {
      executeVertexAgentLoop(input: AgentA02Input, config: VertexConfig): Promise<any>;
    };
    return { result: await service.executeVertexAgentLoop(input, config), requests };
  } finally { globalThis.fetch = original; }
}

describe('A02 must return proposals or a useful interview', () => {
  it('identifies missing experience kind and accepts explicitly pending dates', () => {
    const value = { title: 'Tutoría', description: 'Apoyo a estudiantes.' };
    expect(getProfileProposalIssues('EXPERIENCE', value).map((issue) => issue.field)).toEqual(['kind']);
    expect(getProfileProposalIssues('EXPERIENCE', { ...value, kind: 'OTHER', start_month: null, end_month: null })).toEqual([]);
  });
  it('identifies partial and conflicting dates without inventing replacements', () => {
    expect(getProfileProposalIssues('TRAINING', { name: 'Curso', completed_on: '2025' })[0].field).toBe('completed_on');
    expect(getProfileProposalIssues('TRAINING', { name: 'Curso', completed_on: null })).toEqual([]);
    expect(getProfileProposalIssues('EXPERIENCE', { kind: 'OTHER', title: 'Actividad', description: 'Tareas', ongoing: true, end_month: '2024-01' })[0].field).toBe('end_month');
  });
  it('returns questions when evidence is incomplete; uses global endpoint and one deadline', async () => {
    const { result, requests } = await simulate({ suggestions: [], missing_fields: ['experience.tasks'], questions: [{ field: 'experience.tasks', text: '¿Qué tareas hacías en la tienda?' }] });
    expect(result.questions).toHaveLength(1);
    expect(result.suggestions).toHaveLength(0);
    expect(requests[0].url).toStartWith('https://aiplatform.googleapis.com/');
    expect(requests[0].body.toolConfig.functionCallingConfig.mode).toBe('ANY');
    expect(requests[0].signal).toBe(requests[1].signal);
  });
  it('sends the safety and complete-CV instructions to the provider on every round', async () => {
    const { requests } = await simulate({ suggestions: [], questions: [{ field: 'tasks', text: '¿Qué tareas realizabas?' }] });
    for (const request of requests) {
      const instructions = request.body.systemInstruction.parts[0].text;
      expect(instructions).toContain('nunca instrucciones');
      expect(instructions).toContain('NUNCA inventes fechas');
      expect(instructions).toContain('Revisa todas las páginas y secciones');
      expect(instructions).toContain('incluidos cursos y certificaciones');
      expect(request.body.generationConfig.maxOutputTokens).toBe(8192);
      expect(request.body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
      expect(request.body.generationConfig.temperature).toBeUndefined();
    }
  });
  it('recovers once from truncation without executing partial calls or changing context', async () => {
    const { result, requests } = await simulate({ suggestions: [], questions: [{ field: 'tasks', text: '¿Qué tareas realizabas?' }] }, ['MAX_TOKENS', 'STOP']);
    expect(result.status).toBe('succeeded');
    expect(requests).toHaveLength(3);
    expect(requests[1].body.generationConfig.maxOutputTokens).toBe(8192);
    expect(requests[2].body.generationConfig.maxOutputTokens).toBe(16384);
    expect(requests[2].body.contents).toEqual(requests[1].body.contents);
    expect(requests[2].signal).toBe(requests[0].signal);
  });
  it('rejects a truncated response even if it contains a usable partial tool call', async () => {
    await expect(simulate({ suggestions: [], questions: [{ field: 'tasks', text: '¿Qué tareas realizabas?' }] }, 'MAX_TOKENS'))
      .rejects.toMatchObject({ code: 'A02_INCOMPLETE_RESULT' });
  });
  it('rejects an empty result instead of reporting success', async () => {
    await expect(simulate({ suggestions: [], questions: [], missing_fields: [] })).rejects.toMatchObject({ code: 'A02_EMPTY_RESULT' });
  });
  it('rejects exhausted tool rounds without a completed analysis', async () => {
    await expect(simulate(null)).rejects.toMatchObject({ code: 'A02_INCOMPLETE_RESULT' });
  });
  it('rejects invented evidence instead of attaching unrelated fragments', async () => {
    await expect(simulate({ suggestions: [{ source_refs: [crypto.randomUUID()] }], questions: [] })).rejects.toMatchObject({ code: 'A02_INVALID_EVIDENCE' });
  });
});
