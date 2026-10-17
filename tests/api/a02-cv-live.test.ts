import { it, expect } from 'bun:test';
import { AgentA02Service } from '../../apps/api/src/modules/profile/agent-a02.service';

// Opt-in: uses the real provider, synthetic data, no database and no personal CV.
it.skipIf(process.env.RUN_VERTEX_CV_EVAL !== '1')('Vertex completes a synthetic multi-section CV without dropping distinct courses', async () => {
  const sourceId = crypto.randomUUID();
  const text = `PERFIL PROFESIONAL
Estudiante que busca su primera oportunidad en soporte de tecnologia.
FORMACION ACADEMICA
Ingenieria de Sistemas | En curso | Universidad Demo
Bachiller en Ciencias | Colegio Demo | 2021
CONOCIMIENTOS TECNICOS
Windows: manejo basico; redes y conectividad: conocimientos basicos.
Office: Word, Excel y PowerPoint basicos; Power BI academico.
Herramientas: GitHub y Visual Studio Code.
Programacion: fundamentos de C++ y Python; HTML y CSS basicos.
Bases de datos: SQL, modelado relacional y SQL Server a nivel academico.
EXPERIENCIA ACADEMICA
Tutoria de Algebra | Universidad Demo
Apoyo voluntario a estudiantes durante practicas; explicar procedimientos y resolver ejercicios.
CERTIFICACIONES
Analisis de datos con Python | Academia Demo | 2026
Fundamentos de Python 1 y 2 | Academia Demo | 2026
Curso Practico de C++ | Centro Demo | 2025
IDIOMAS
Espanol nativo. Ingles A2 en desarrollo.`;
  const result = await new AgentA02Service().interpretProfile({
    runId: crypto.randomUUID(), goal: 'build_profile',
    draft: { id: crypto.randomUUID(), profile_id: crypto.randomUUID(), base_version_id: null,
      revision: 1, status: 'DRAFT', version_number: null, display_name: 'Persona Demo', headline: null,
      experience_status: 'UNKNOWN', training_status: 'UNKNOWN', interests_status: 'UNKNOWN',
      experiences: [], trainings: [], interests: [], windows: [], constraints: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    fragments: [{ id: sourceId, page: 1, text, start_millis: null, end_millis: null }],
  });
  expect(result.provider).toBe('vertex-gemini-3.8-flash');
  expect(result.runView.status).toBe('succeeded');
  const suggestions = result.runView.suggestions;
  const trainings = suggestions.filter((item) => item.section === 'TRAINING');
  expect(trainings).toHaveLength(5);
  const names = trainings.map((item) => String((item.proposed_value as Record<string, unknown>).name).toLowerCase());
  for (const term of ['ingenier', 'bachiller', 'datos', 'python 1', 'c++']) {
    expect(names.some((name) => name.includes(term))).toBe(true);
  }
  expect(suggestions.some((item) => item.section === 'EXPERIENCE')).toBe(true);
  expect(suggestions.some((item) => item.section === 'COMPETENCIES')).toBe(true);
  for (const item of suggestions) expect(item.source_refs).toEqual([sourceId]);
  console.log(JSON.stringify({ provider: result.provider, proposals: suggestions.length, trainings: trainings.length, questions: result.runView.questions.length }));
}, 125000);
