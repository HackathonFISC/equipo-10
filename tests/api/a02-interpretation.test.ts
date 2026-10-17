import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { AgentA02Service } from "../../apps/api/src/modules/profile/agent-a02.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";
import type { Hono } from "hono";
import type { AppEnv } from "../../apps/api/src/app";

describe("D2-B Integration: Agent A02 Text Interpretation, Grants & Atomic Batch Decisions", () => {
  let auth: AuthFixture;
  let dbFixture: DatabaseFixture;
  let app: Hono<AppEnv>;
  let sourceId: string;
  let grantId: string;
  let draftId: string;
  let runId: string;

  beforeAll(async () => {
    auth = startAuthFixture(0);
    dbFixture = await setupTestDatabase();

    const verifyToken = createVerifyToken({ ...dbFixture.config, supabaseUrl: auth.url });
    const identityService = new IdentityService(dbFixture.db);
    
    // Inyección explícita de mock runner para las pruebas de API deterministas de integración rápida
    const testA02Runner = async (input: any) => {
      const fragId = input.fragments[0]?.id || "frag-1";
      return {
        run_id: input.runId,
        status: "succeeded" as const,
        agent_id: "A02" as const,
        contract_version: "agent-result/1" as const,
        goal: input.goal,
        draft_ref: {
          id: input.draft.id,
          revision: input.draft.revision,
        },
        suggestions: [
          {
            suggestion_id: crypto.randomUUID(),
            section: "EXPERIENCE" as const,
            field: "experience_entry",
            proposed_value: {
              kind: "INFORMAL",
              title: "Asistente de bodega",
              organization_name: "Almacén Central",
              description: "Inventario, empaque y despacho de pedidos",
              start_month: "2024-01",
              end_month: "2024-06",
              ongoing: false,
            },
            source_refs: [fragId],
            rationale: "Declarado en texto del fragmento de origen",
            confidence: 0.9,
          },
          {
            suggestion_id: crypto.randomUUID(),
            section: "TRAINING" as const,
            field: "training_entry",
            proposed_value: {
              name: "Taller de primeros auxilios",
              provider_name: "Centro de Capacitación",
              completed_month: "2024-05",
            },
            source_refs: [fragId],
            rationale: "Declarado en texto del fragmento de origen",
            confidence: 0.85,
          },
          {
            suggestion_id: crypto.randomUUID(),
            section: "INTERESTS" as const,
            field: "job_interest_entry",
            proposed_value: {
              original_text: "cajero o atención al cliente",
            },
            source_refs: [fragId],
            rationale: "Interés laboral declarado por el postulante",
            confidence: 0.95,
          },
        ],
        missing_fields: [],
        questions: [],
        created_at: new Date().toISOString(),
      };
    };

    const a02Service = new AgentA02Service(dbFixture.db, testA02Runner);
    const profileService = new ProfileService(dbFixture.db, a02Service);

    app = createApp({
      identityService,
      profileService,
      verifyToken,
      allowedOrigins: dbFixture.config.allowedOrigins,
    });

    // 1. Bootstrap User A
    const resA = await app.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resA.status).toBe(200);

    // 2. Ensure Profile
    const profA = await app.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(profA.status).toBe(200);

    // 3. Initialize Draft (Revision 1)
    const draftRes = await app.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "d2b-init-draft-key-12345678",
      },
      body: JSON.stringify({ base_version_id: null }),
    });
    expect(draftRes.status).toBe(201);
    const draftJson = await draftRes.json();
    draftId = draftJson.data.id;
    expect(draftJson.data.revision).toBe(1);
  });

  afterAll(async () => {
    if (auth) auth.stop();
    if (dbFixture) await dbFixture.close();
  });

  it("creates a manual text source and fragments successfully", async () => {
    const text =
      "Laboré como asistente de bodega en Almacén Central realizando inventario, empaque y despacho de pedidos. También completé un taller de primeros auxilios y deseo laborar como cajero o atención al cliente.";

    const res = await app.request("/api/v1/me/profile-sources", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "source-text-create-key-123456",
      },
      body: JSON.stringify({ kind: "manual_text", text }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.kind).toBe("MANUAL_TEXT");
    expect(body.data.status).toBe("READY");
    expect(body.data.fragments_count).toBe(1);
    expect(body.data.fragments[0].text).toBe(text);
    sourceId = body.data.id;

    // Retrieve via GET /profile-sources/:id
    const getRes = await app.request(`/api/v1/me/profile-sources/${sourceId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.data.id).toBe(sourceId);
    expect(getBody.data.fragments.length).toBe(1);
  });

  it("rejects interpretation grant request with mismatched revision or missing sources", async () => {
    // 1. Mismatched revision (draft is revision 1, we send revision 99)
    const resMismatched = await app.request("/api/v1/me/profile-interpretation-grants", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "grant-mismatch-key-12345678",
      },
      body: JSON.stringify({
        source_refs: [{ id: sourceId, version: 1 }],
        draft_revision: 99,
        purpose: "profile_interpretation",
        provider: "vertex",
      }),
    });
    expect(resMismatched.status).toBe(409);
    const jsonMismatched = await resMismatched.json();
    expect(jsonMismatched.error.code).toBe("BASE_VERSION_CONFLICT");

    // 2. Non-existent source
    const resInvalidSource = await app.request("/api/v1/me/profile-interpretation-grants", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "grant-badsource-key-12345678",
      },
      body: JSON.stringify({
        source_refs: [{ id: "00000000-0000-0000-0000-000000000000", version: 1 }],
        draft_revision: 1,
        purpose: "profile_interpretation",
        provider: "vertex",
      }),
    });
    expect(resInvalidSource.status).toBe(422);
    const jsonInvalidSource = await resInvalidSource.json();
    expect(jsonInvalidSource.error.code).toBe("PROCESSING_GRANT_REQUIRED");
  });

  it("creates an active interpretation grant and replays idempotently", async () => {
    const grantPayload = {
      source_refs: [{ id: sourceId, version: 1 }],
      draft_revision: 1,
      purpose: "profile_interpretation",
      provider: "vertex",
    };

    const res = await app.request("/api/v1/me/profile-interpretation-grants", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "grant-valid-idempotent-key-01",
      },
      body: JSON.stringify(grantPayload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.status).toBe("ACTIVE");
    expect(body.data.draft_revision).toBe(1);
    grantId = body.data.grant_id;

    // Idempotent replay
    const replayRes = await app.request("/api/v1/me/profile-interpretation-grants", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "grant-valid-idempotent-key-01",
      },
      body: JSON.stringify(grantPayload),
    });
    expect(replayRes.status).toBe(201); // or 200
    const replayBody = await replayRes.json();
    expect(replayBody.data.grant_id).toBe(grantId);
  });

  it("rejects interpretation without If-Match or with stale If-Match", async () => {
    const interpPayload = {
      draft_id: draftId,
      source_refs: [{ id: sourceId, version: 1 }],
      grant_id: grantId,
      goal: "build_profile",
    };

    // 1. Missing If-Match
    const resNoEtag = await app.request("/api/v1/me/profile-interpretations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "interp-noetag-key-12345678",
      },
      body: JSON.stringify(interpPayload),
    });
    expect(resNoEtag.status).toBe(428);

    // 2. Stale If-Match (revision is 1, sending 99)
    const resStale = await app.request("/api/v1/me/profile-interpretations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "99",
        "Idempotency-Key": "interp-stale-key-123456789",
      },
      body: JSON.stringify(interpPayload),
    });
    expect(resStale.status).toBe(412);
  });

  it("executes interpretation run requesting A02 and retrieves structured suggestions", async () => {
    const interpPayload = {
      draft_id: draftId,
      source_refs: [{ id: sourceId, version: 1 }],
      grant_id: grantId,
      goal: "build_profile",
    };

    const res = await app.request("/api/v1/me/profile-interpretations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "1",
        "Idempotency-Key": "interp-valid-exec-key-12345",
      },
      body: JSON.stringify(interpPayload),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.data.agent_id).toBe("A02");
    expect(body.data.contract_version).toBe("agent-result/1");
    expect(body.data.status).toBe("succeeded");
    expect(Array.isArray(body.data.suggestions)).toBe(true);
    expect(body.data.suggestions.length).toBeGreaterThan(0);
    runId = body.data.run_id;

    // Check that we got suggestions for EXPERIENCE, TRAINING, and INTERESTS
    const sections = body.data.suggestions.map((s: any) => s.section);
    expect(sections).toContain("EXPERIENCE");
    expect(sections).toContain("TRAINING");
    expect(sections).toContain("INTERESTS");

    // Check GET /profile-interpretations/:runId
    const getRunRes = await app.request(`/api/v1/me/profile-interpretations/${runId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(getRunRes.status).toBe(200);
    const getRunBody = await getRunRes.json();
    expect(getRunBody.data.run_id).toBe(runId);
    expect(getRunBody.data.suggestions.length).toBe(body.data.suggestions.length);
  });

  it("rejects invalid corrections, repeated choices and foreign suggestion IDs without mutating the draft", async () => {
    const runResponse = await app.request('/api/v1/me/profile-interpretations/' + runId, { headers: { Authorization: 'Bearer ' + auth.tokens.a } });
    const ownRun = (await runResponse.json()).data;
    const suggestion = ownRun.suggestions.find((item: any) => item.section === 'EXPERIENCE');
    const cases = [
      [{ suggestion_id: suggestion.suggestion_id, decision: 'accept', replacement_value: { kind: 'INFORMAL', title: '' } }],
      [{ suggestion_id: suggestion.suggestion_id, decision: 'accept' }, { suggestion_id: suggestion.suggestion_id, decision: 'reject' }],
      [{ suggestion_id: crypto.randomUUID(), decision: 'accept' }],
      [{ suggestion_id: suggestion.suggestion_id, decision: 'accept', replacement_value: { title: 'Tutoría', description: 'Apoyo a estudiantes.' } }],
      [{ suggestion_id: suggestion.suggestion_id, decision: 'accept', replacement_value: { kind: 'OTHER', title: 'Tutoría', description: 'Apoyo a estudiantes.', start_month: '2024' } }],
    ];
    for (const [index, decisions] of cases.entries()) {
      const response = await app.request('/api/v1/me/candidate-profile/draft/suggestion-decisions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + auth.tokens.a, 'Content-Type': 'application/json', 'If-Match': '1', 'Idempotency-Key': 'invalid-correction-case-' + index },
        body: JSON.stringify({ run_id: runId, decisions }),
      });
      expect(response.status).toBe(400);
      if (index === 3 || index === 4) {
        const payload = await response.json();
        expect(payload.error.code).toBe('INVALID_PROPOSAL');
        expect(payload.error.message).toContain('Tutoría');
        expect(payload.error.field_errors[0].field).toBe(index === 3 ? 'kind' : 'start_month');
        expect(payload.error.message).not.toContain('Revisa el nombre, las fechas');
      }
    }
    const draftResponse = await app.request('/api/v1/me/candidate-profile/draft', { headers: { Authorization: 'Bearer ' + auth.tokens.a } });
    const current = (await draftResponse.json()).data;
    expect(current.revision).toBe(1);
    expect(current.experiences).toHaveLength(0);
  });

  it("applies atomic suggestion batch decisions, updates draft revision and creates evidence links", async () => {
    // 1. Fetch suggestions from run
    const getRun = await app.request(`/api/v1/me/profile-interpretations/${runId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    const runData = (await getRun.json()).data;
    const expSugg = runData.suggestions.find((s: any) => s.section === "EXPERIENCE");
    const trnSugg = runData.suggestions.find((s: any) => s.section === "TRAINING");
    const intSugg = runData.suggestions.find((s: any) => s.section === "INTERESTS");

    expect(expSugg).toBeDefined();
    expect(trnSugg).toBeDefined();

    // 2. Submit batch decision: accept experience & training, defer interests
    const batchPayload = {
      run_id: runId,
      decisions: [
        { suggestion_id: expSugg.suggestion_id, decision: "accept" },
        { suggestion_id: trnSugg.suggestion_id, decision: "accept" },
        { suggestion_id: intSugg ? intSugg.suggestion_id : undefined, decision: "defer" },
      ].filter((d) => d.suggestion_id !== undefined),
    };

    // Reproduce remote latency: six inserted rows take over Prisma's default 5s deadline.
    const delayedTables = ['ProfileExperience', 'TrainingDeclaration', 'ProfileEvidence', 'ProfileEvidenceLink'];
    await dbFixture.admin.query(`CREATE FUNCTION app.test_slow_batch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1); RETURN NEW; END $$;`);
    for (const table of delayedTables) await dbFixture.admin.query(`CREATE TRIGGER test_slow_batch BEFORE INSERT ON app."${table}" FOR EACH ROW EXECUTE FUNCTION app.test_slow_batch();`);
    let res: Response;
    try {
      res = await app.request("/api/v1/me/candidate-profile/draft/suggestion-decisions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "1",
        "Idempotency-Key": "batch-decision-valid-key-01",
      },
      body: JSON.stringify(batchPayload),
    });

    } finally {
      for (const table of delayedTables) await dbFixture.admin.query(`DROP TRIGGER test_slow_batch ON app."${table}";`);
      await dbFixture.admin.query('DROP FUNCTION app.test_slow_batch();');
    }
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe("2");
    const body = await res.json();
    expect(body.data.new_revision).toBe(2);
    expect(body.data.accepted_count).toBe(2);
    expect(body.data.deferred_count).toBe(intSugg ? 1 : 0);

    // Verify draft now has 1 experience and 1 training declaration, and statuses are PROVIDED
    expect(body.data.draft.revision).toBe(2);
    expect(body.data.draft.experience_status).toBe("PROVIDED");
    expect(body.data.draft.training_status).toBe("PROVIDED");
    expect(body.data.draft.experiences.length).toBe(1);
    expect(body.data.draft.trainings.length).toBe(1);
    const savedProfile = await app.request('/api/v1/me/candidate-profile', { headers: { Authorization: 'Bearer ' + auth.tokens.a } });
    const readProfile = (await savedProfile.json()).data;
    expect(readProfile.active_draft.id).toBe(draftId);
    expect(readProfile.active_draft.experiences[0].title).toBe('Asistente de bodega');
    expect(readProfile.active_draft.trainings[0].name).toBe('Taller de primeros auxilios');

    // 3. Replay with same Idempotency-Key returns saved receipt
    const replayRes = await app.request("/api/v1/me/candidate-profile/draft/suggestion-decisions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "1", // even with stale If-Match, idempotency lookup evaluates first!
        "Idempotency-Key": "batch-decision-valid-key-01",
      },
      body: JSON.stringify(batchPayload),
    });
    expect(replayRes.status).toBe(200);
    const replayBody = await replayRes.json();
    expect(replayBody.data.receipt_id).toBe(body.data.receipt_id);

    // 4. Stale run rejection: Attempting to apply suggestions from runId with new If-Match: 2 is rejected
    // because run was executed against base revision 1, not revision 2!
    const staleRes = await app.request("/api/v1/me/candidate-profile/draft/suggestion-decisions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "2",
        "Idempotency-Key": "batch-decision-stale-key-02",
      },
      body: JSON.stringify({
        run_id: runId,
        decisions: [{ suggestion_id: expSugg.suggestion_id, decision: "accept" }],
      }),
    });
    expect(staleRes.status).toBe(409);
    const staleJson = await staleRes.json();
    expect(staleJson.error.code).toBe("STALE_INTERPRETATION");
  }, 20000);

  it("revokes an interpretation grant and rejects subsequent interpretation requests with 422", async () => {
    // Revoke grantId
    const revokeRes = await app.request(`/api/v1/me/profile-interpretation-grants/${grantId}/revocations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "revoke-grant-key-1234567890",
      },
      body: JSON.stringify({}),
    });
    expect(revokeRes.status).toBe(200);
    const revokeBody = await revokeRes.json();
    expect(revokeBody.data.status).toBe("REVOKED");

    // Try to run interpretation with the revoked grant
    const res = await app.request("/api/v1/me/profile-interpretations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "2",
        "Idempotency-Key": "interp-after-revocation-key",
      },
      body: JSON.stringify({
        draft_id: draftId,
        source_refs: [{ id: sourceId, version: 1 }],
        grant_id: grantId,
        goal: "build_profile",
      }),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("PROCESSING_GRANT_REQUIRED");
  });
  it("adds manual experience and training after AI import without losing linked evidence", async () => {
    const authHeaders = { Authorization: 'Bearer ' + auth.tokens.a };
    const read = async () => (await (await app.request('/api/v1/me/candidate-profile/draft', { headers: authHeaders })).json()).data;
    let current = await read();
    const originalExperience = current.experiences[0].id;
    const originalTraining = current.trainings[0].id;
    const linksBefore = (await dbFixture.admin.query('SELECT count(*)::int AS n FROM app."ProfileEvidenceLink"')).rows[0].n;
    const patch = (section: string, items: any[]) => app.request('/api/v1/me/candidate-profile/draft', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json', 'If-Match': String(current.revision) },
      body: JSON.stringify({ section, values: { status: 'PROVIDED', items } }),
    });
    const foreign = await patch('experience', [{ ...current.experiences[0], id: crypto.randomUUID() }]);
    expect(foreign.status).toBe(400);
    const experienceResponse = await patch('experience', [...current.experiences, { kind: 'VOLUNTEER', title: 'Apoyo comunitario', description: 'Organización de materiales.' }]);
    expect(experienceResponse.status).toBe(200);
    current = (await experienceResponse.json()).data;
    expect(current.experiences).toHaveLength(2);
    expect(current.experiences.some((entry: any) => entry.id === originalExperience)).toBe(true);
    const trainingResponse = await patch('training', [...current.trainings, { name: 'Curso manual adicional', provider_name: 'Centro Demo' }]);
    expect(trainingResponse.status).toBe(200);
    current = (await trainingResponse.json()).data;
    expect(current.trainings).toHaveLength(2);
    expect(current.trainings.some((entry: any) => entry.id === originalTraining)).toBe(true);
    const linksAfter = (await dbFixture.admin.query('SELECT count(*)::int AS n FROM app."ProfileEvidenceLink"')).rows[0].n;
    expect(linksAfter).toBe(linksBefore);
    expect(linksAfter).toBeGreaterThan(0);
  });

  it('rolls back writes on a real expired transaction and returns a retryable timeout', async () => {
    const actor = await dbFixture.db.resolveAuthSubject(auth.users.a.id, false);
    expect(actor).not.toBeNull();
    const draft = (await (await app.request('/api/v1/me/candidate-profile/draft', { headers: { Authorization: 'Bearer ' + auth.tokens.a } })).json()).data;
    const rowId = crypto.randomUUID();
    await expect(dbFixture.db.withActor(actor!, async (tx) => {
      await tx.profileExperience.create({ data: { id: rowId, profileId: draft.profile_id, revisionId: draft.id,
        kind: 'OTHER', title: 'Registro que debe revertirse', description: 'Fixture de timeout.' } });
      await new Promise((resolve) => setTimeout(resolve, 300));
      return tx.profileExperience.count();
    }, { timeout: 200 })).rejects.toMatchObject({ code: 'DATABASE_TRANSACTION_TIMEOUT', status: 503, retryable: true });
    const stored = await dbFixture.admin.query('SELECT id FROM app."ProfileExperience" WHERE id = $1', [rowId]);
    expect(stored.rowCount).toBe(0);
  }, 15000);

});
