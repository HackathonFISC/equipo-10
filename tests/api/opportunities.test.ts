import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { OpportunitiesService } from "../../apps/api/src/modules/opportunities/opportunities.service";
import { AgentA03Service } from "../../apps/api/src/modules/opportunities/agent-a03.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";

describe("D3-1 Opportunities Exploration and Reading API", () => {
  let dbFixture: DatabaseFixture;
  let authFixture: AuthFixture;
  let client: ReturnType<typeof createApp>;
  let userToken: string;

  // Test data IDs with valid RFC 4122 v4 format
  const catalogVersionId = "c0000000-0000-4000-8000-000000000001";
  const occupationId = "0a000000-0000-4000-8000-000000000001";
  const competency1Id = "11111111-0000-4000-8000-000000000001";
  const competency2Id = "22222222-0000-4000-8000-000000000002";
  const companyOrgId = "90000000-0000-4000-8000-000000000001";
  const activeOppId = "a0000000-0000-4000-8000-000000000001";
  const inactiveOppId = "b0000000-0000-4000-8000-000000000002";

  beforeAll(async () => {
    dbFixture = await setupTestDatabase();
    authFixture = startAuthFixture(55439);

    const config = {
      ...dbFixture.config,
      supabaseUrl: authFixture.url,
      allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
    };

    const identityService = new IdentityService(dbFixture.db);
    const profileService = new ProfileService(dbFixture.db);
    const testA03Runner = async (input: any) => ({
      id: crypto.randomUUID(),
      comparison_id: input.comparisonId,
      agent_id: "A03" as const,
      contract_version: "agent-result/1" as const,
      status: "completed" as const,
      summary: "Tu perfil presenta una compatibilidad positiva con el puesto de Auxiliar de Bodega e Inventario.",
      decision: {
        code: "FEASIBILITY_VIABLE",
        feasibility: "VIABLE" as const,
        reasons: ["Cumple con los requisitos esenciales de entrada"],
      },
      missing_fields: [],
      questions: [],
      created_at: new Date().toISOString(),
    });
    const agentA03Service = new AgentA03Service(dbFixture.db, testA03Runner);
    const opportunitiesService = new OpportunitiesService(dbFixture.db, agentA03Service);
    const verifyToken = createVerifyToken(config);

    client = createApp({
      identityService,
      profileService,
      opportunitiesService,
      verifyToken,
      allowedOrigins: config.allowedOrigins,
    });

    userToken = authFixture.tokens.a;

    // Bootstrap User A
    const resA = await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resA.status).toBe(200);

    // Initialize candidate profile for User A
    const profA = await client.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(profA.status).toBe(200);

    // Seed Catalog, Occupation, Competencies, Organization, and Opportunities
    await dbFixture.admin.query(`
      INSERT INTO app."CatalogVersion" ("id", "code", "sourceLabel")
      VALUES ('${catalogVersionId}', 'CAT-PA-2026', 'Catálogo Nacional de Competencias Demo')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."OccupationEntry" ("id", "catalogVersionId", "code", "name", "description", "active")
      VALUES ('${occupationId}', '${catalogVersionId}', '9333', 'Auxiliar de bodega', 'Labores de almacén e inventario', true)
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CompetencyEntry" ("id", "catalogVersionId", "code", "name", "description", "kind")
      VALUES
        ('${competency1Id}', '${catalogVersionId}', 'COMP-INV-01', 'Registro de inventario', 'Registro físico y digital de existencias', 'SKILL'),
        ('${competency2Id}', '${catalogVersionId}', 'COMP-FORK-01', 'Manejo de transpaleta manual', 'Traslado seguro de mercancía en piso', 'SKILL')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Organization" ("id", "name", "type", "active", "updatedAt")
      VALUES ('${companyOrgId}', 'Distribuidora Panamá Pacífico S.A.', 'COMPANY', true, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Opportunity" (
        "id", "organizationId", "title", "description", "occupationId", "catalogVersionId",
        "location", "workplaceType", "salaryAmount", "salaryCurrency", "salaryPeriod",
        "scheduleSummary", "availableSlots", "active", "isDemo", "version", "publishedAt"
      ) VALUES (
        '${activeOppId}', '${companyOrgId}', 'Auxiliar de Bodega e Inventario',
        'Responsable del conteo de existencias y estiba de pedidos.',
        '${occupationId}', '${catalogVersionId}', 'Ciudad de Panamá, Juan Díaz',
        'ON_SITE', 650.00, 'USD', 'MONTH', 'Lunes a Viernes 08:00 - 17:00',
        3, true, true, 1, NOW()
      ), (
        '${inactiveOppId}', '${companyOrgId}', 'Vacante Cerrada / Inactiva',
        'Puesto no disponible.',
        '${occupationId}', '${catalogVersionId}', 'Ciudad de Panamá',
        'REMOTE', 800.00, 'USD', 'MONTH', 'Flexible',
        1, false, true, 1, NOW()
      );

      INSERT INTO app."OpportunityRequirement" (
        "id", "opportunityId", "competencyId", "catalogVersionId", "requirementType", "stage", "description"
      ) VALUES (
        gen_random_uuid(), '${activeOppId}', '${competency1Id}', '${catalogVersionId}', 'ESSENTIAL', 'ENTRY', 'Manejo básico de inventarios'
      ), (
        gen_random_uuid(), '${activeOppId}', '${competency2Id}', '${catalogVersionId}', 'DESIRABLE', 'TRAINABLE', 'Se capacita en transpaleta'
      );
    `);
  });

  afterAll(async () => {
    authFixture.stop();
    await dbFixture.close();
  });

  it("lists active opportunities and filters out inactive ones", async () => {
    const res = await client.request("/api/v1/opportunities", {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toBeDefined();
    expect(body.data.items).toBeArray();
    expect(body.data.pagination.total).toBe(1);

    const opp = body.data.items[0];
    expect(opp.id).toBe(activeOppId);
    expect(opp.title).toBe("Auxiliar de Bodega e Inventario");
    expect(opp.organization.name).toBe("Distribuidora Panamá Pacífico S.A.");
    expect(opp.occupation.name).toBe("Auxiliar de bodega");
    expect(opp.workplace_type).toBe("ON_SITE");
    expect(opp.salary_amount).toBe("650.00");
    expect(opp.salary_currency).toBe("USD");
    expect(opp.salary_period).toBe("MONTH");
    expect(opp.is_demo).toBe(true);
    expect(opp.version).toBe(1);
    expect(body.request_id).toBeDefined();
  });

  it("filters opportunities by query search term 'Bodega'", async () => {
    const res = await client.request("/api/v1/opportunities?q=Bodega", {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].id).toBe(activeOppId);
  });

  it("filters opportunities by query search term that yields no matches", async () => {
    const res = await client.request("/api/v1/opportunities?q=Astronauta", {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.items.length).toBe(0);
    expect(body.data.pagination.total).toBe(0);
  });

  it("filters opportunities by workplace_type", async () => {
    const resMatch = await client.request("/api/v1/opportunities?workplace_type=ON_SITE", {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    expect(resMatch.status).toBe(200);
    const bodyMatch = (await resMatch.json()) as any;
    expect(bodyMatch.data.items.length).toBe(1);

    const resNoMatch = await client.request("/api/v1/opportunities?workplace_type=REMOTE", {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    expect(resNoMatch.status).toBe(200);
    const bodyNoMatch = (await resNoMatch.json()) as any;
    expect(bodyNoMatch.data.items.length).toBe(0);
  });

  it("retrieves opportunity detail with requirements and stage breakdown", async () => {
    const res = await client.request(`/api/v1/opportunities/${activeOppId}`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const data = body.data;

    expect(data.id).toBe(activeOppId);
    expect(data.title).toBe("Auxiliar de Bodega e Inventario");
    expect(data.description).toBe("Responsable del conteo de existencias y estiba de pedidos.");
    expect(data.organization.name).toBe("Distribuidora Panamá Pacífico S.A.");
    expect(data.requirements.length).toBe(2);

    const reqEssential = data.requirements.find((r: any) => r.requirement_type === "ESSENTIAL");
    expect(reqEssential).toBeDefined();
    expect(reqEssential.stage).toBe("ENTRY");
    expect(reqEssential.competency_name).toBe("Registro de inventario");

    const reqDesirable = data.requirements.find((r: any) => r.requirement_type === "DESIRABLE");
    expect(reqDesirable).toBeDefined();
    expect(reqDesirable.stage).toBe("TRAINABLE");
    expect(reqDesirable.competency_name).toBe("Manejo de transpaleta manual");
  });

  it("returns 404 for an inactive opportunity", async () => {
    const res = await client.request(`/api/v1/opportunities/${inactiveOppId}`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("OPPORTUNITY_NOT_FOUND");
  });

  it("returns 404 for a nonexistent opportunity UUID", async () => {
    const nonexistentId = "00000000-0000-4000-8000-000000000999";
    const res = await client.request(`/api/v1/opportunities/${nonexistentId}`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("OPPORTUNITY_NOT_FOUND");
  });

  it("returns 400 for a malformed UUID param", async () => {
    const res = await client.request("/api/v1/opportunities/not-a-uuid", {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("INVALID_ID");
  });

  it("rejects POST /me/opportunity-comparisons when candidate has no confirmed profile with 400", async () => {
    const res = await client.request("/api/v1/me/opportunity-comparisons", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-idem-key-0000000001",
      },
      body: JSON.stringify({
        opportunity_id: activeOppId,
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("CONFIRMED_PROFILE_REQUIRED");
  });

  it("rejects POST /me/opportunity-comparisons without valid Idempotency-Key with 400", async () => {
    const res = await client.request("/api/v1/me/opportunity-comparisons", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        opportunity_id: activeOppId,
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  let comparisonId: string;

  it("confirms profile for User A and creates a viable comparison returning 201", async () => {
    // 1. Create draft and confirmed version for User A
    const resDraft = await client.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-idem-draft-0000001",
      },
      body: JSON.stringify({}),
    });
    expect(resDraft.status).toBe(201);
    const draftBody = (await resDraft.json()) as any;
    const draftId = draftBody.data.id;

    // Set identity, experience, constraints
    await client.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "If-Match": "1",
      },
      body: JSON.stringify({
        section: "identity",
        values: { display_name: "Juan Pérez", headline: "Auxiliar con experiencia" },
      }),
    });

    await client.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "If-Match": "2",
      },
      body: JSON.stringify({
        section: "constraints",
        values: {
          salary_state: "KNOWN",
          minimum_salary: "600.00",
          salary_currency: "USD",
          salary_period: "MONTH",
          travel_limit_state: "KNOWN",
          max_one_way_minutes: 60,
          location_state: "UNKNOWN",
          availability_state: "KNOWN",
          mobility_state: "UNKNOWN",
          transport_state: "UNKNOWN",
          training_state: "UNKNOWN",
        },
      }),
    });

    // Add accepted claim for competency1Id directly in DB for this confirmed version
    const profileRow = await dbFixture.admin.query<{ id: string }>(
      `SELECT "id" FROM app."CandidateProfile" WHERE "ownerUserId" = (SELECT id FROM app."AppUser" WHERE "authSubject" = $1)`,
      [authFixture.users.a.id]
    );
    const pId = profileRow.rows[0].id;

    await dbFixture.admin.query(`
      WITH new_src AS (
        INSERT INTO app."ProfileSource" (
          "id", "profileId", "kind", "status", "sha256", "mediaType", "sizeBytes", "manualText"
        ) VALUES (
          gen_random_uuid(), '${pId}', 'MANUAL_TEXT', 'READY', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'text/plain', 50, 'Registro de existencias en tienda familiar'
        ) RETURNING id
      ),
      new_frag AS (
        INSERT INTO app."SourceFragment" (
          "id", "profileId", "sourceId", "text"
        ) SELECT gen_random_uuid(), '${pId}', id, 'Registro de existencias en tienda familiar' FROM new_src
        RETURNING id
      ),
      new_ev AS (
        INSERT INTO app."ProfileEvidence" (
          "id", "profileId", "fragmentId", "kind", "scope"
        ) SELECT gen_random_uuid(), '${pId}', id, 'DOCUMENT', 'Evidencia de inventario' FROM new_frag
        RETURNING id
      ),
      new_claim AS (
        INSERT INTO app."CompetencyClaim" (
          "id", "profileId", "revisionId", "competencyId", "catalogVersionId",
          "originalText", "criterion", "decision"
        ) VALUES (
          gen_random_uuid(), '${pId}', '${draftId}', '${competency1Id}', '${catalogVersionId}',
          'Inventario en tienda familiar', 'Registro diario de entradas y salidas', 'ACCEPTED'
        ) RETURNING id
      )
      INSERT INTO app."ProfileEvidenceLink" (
        "id", "profileId", "revisionId", "evidenceId", "claimId"
      ) VALUES (
        gen_random_uuid(), '${pId}', '${draftId}', (SELECT id FROM new_ev), (SELECT id FROM new_claim)
      );

      INSERT INTO app."AvailabilityWindow" (
        "id", "profileId", "revisionId", "weekday", "startMinute", "endMinute", "timezone", "validFrom", "validTo"
      ) VALUES
        (gen_random_uuid(), '${pId}', '${draftId}', 1, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${pId}', '${draftId}', 2, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${pId}', '${draftId}', 3, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${pId}', '${draftId}', 4, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${pId}', '${draftId}', 5, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year');
    `);

    // Complete reviews and confirm
    for (const section of ["ACCOUNT", "EXPERIENCE", "TRAINING", "INTERESTS", "COMPETENCIES", "AVAILABILITY", "CONSTRAINTS", "FINAL_REVIEW"]) {
      await client.request("/api/v1/me/candidate-profile/draft/section-reviews", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `rev-key-${section.toLowerCase()}-001`,
        },
        body: JSON.stringify({ section, decision: "REVIEWED" }),
      });
    }

    const resPreview = await client.request("/api/v1/me/candidate-profile/draft/review-previews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "If-Match": "3",
        "Idempotency-Key": "test-preview-key-00001",
      },
      body: JSON.stringify({}),
    });
    expect(resPreview.status).toBe(201);
    const previewBody = (await resPreview.json()) as any;
    const previewId = previewBody.data.preview_id;

    const draftCur = await client.request("/api/v1/me/candidate-profile/draft", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const curRev = ((await draftCur.json()) as any).data.revision;

    const resConfirm = await client.request("/api/v1/me/candidate-profile/confirmations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "If-Match": String(curRev),
        "Idempotency-Key": "test-confirm-key-00001",
      },
      body: JSON.stringify({
        draft_id: draftId,
        preview_id: previewId,
        acknowledge_partial: true,
      }),
    });
    expect(resConfirm.status).toBe(201);

    // 2. Execute comparison POST /me/opportunity-comparisons
    const resComp = await client.request("/api/v1/me/opportunity-comparisons", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-idem-comp-00000001",
      },
      body: JSON.stringify({
        opportunity_id: activeOppId,
        assumptions: {
          commute_minutes: 35,
        },
      }),
    });

    expect(resComp.status).toBe(201);
    const compBody = (await resComp.json()) as any;
    const compData = compBody.data;

    expect(compData.id).toBeDefined();
    comparisonId = compData.id;
    expect(compData.opportunity_id).toBe(activeOppId);
    expect(compData.status).toBe("VIABLE");
    expect(compData.coverage_numerator).toBe(1);
    expect(compData.coverage_denominator).toBe(2);
    expect(compData.coverage_percent).toBe(50.0);
    expect(compData.breakdown.logistics.salary.status).toBe("CUMPLE");
    expect(compData.breakdown.logistics.commute.status).toBe("CUMPLE");
    expect(compData.outdated).toBe(false);
  });

  it("replays POST /me/opportunity-comparisons with same Idempotency-Key returning 200 with saved comparison", async () => {
    const res = await client.request("/api/v1/me/opportunity-comparisons", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-idem-comp-00000001",
      },
      body: JSON.stringify({
        opportunity_id: activeOppId,
        assumptions: {
          commute_minutes: 35,
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.id).toBe(comparisonId);
  });

  it("rejects POST /me/opportunity-comparisons with same Idempotency-Key but different assumptions with 409", async () => {
    const res = await client.request("/api/v1/me/opportunity-comparisons", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-idem-comp-00000001",
      },
      body: JSON.stringify({
        opportunity_id: activeOppId,
        assumptions: {
          commute_minutes: 50,
        },
      }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("retrieves comparison by ID via GET /me/opportunity-comparisons/:id", async () => {
    const res = await client.request(`/api/v1/me/opportunity-comparisons/${comparisonId}`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.id).toBe(comparisonId);
    expect(body.data.outdated).toBe(false);
  });

  it("lists recent comparisons via GET /me/opportunity-comparisons", async () => {
    const res = await client.request("/api/v1/me/opportunity-comparisons?limit=5", {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].id).toBe(comparisonId);
  });

  it("marks comparison as outdated when opportunity version increments (CASE-D3-13)", async () => {
    // Increment opportunity version in database
    await dbFixture.admin.query(`
      UPDATE app."Opportunity" SET version = version + 1 WHERE id = '${activeOppId}';
    `);

    const res = await client.request(`/api/v1/me/opportunity-comparisons/${comparisonId}`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.outdated).toBe(true);

    // Restore version
    await dbFixture.admin.query(`
      UPDATE app."Opportunity" SET version = 1 WHERE id = '${activeOppId}';
    `);
  });

  it("denies access to comparison across tenants returning 404 (CASE-D3-14)", async () => {
    const userBToken = authFixture.tokens.b;

    // Bootstrap user B
    await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userBToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await client.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userBToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await client.request(`/api/v1/me/opportunity-comparisons/${comparisonId}`, {
      headers: {
        Authorization: `Bearer ${userBToken}`,
      },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("COMPARISON_NOT_FOUND");
  });

  it("rejects POST /me/opportunity-comparisons/:id/explanations without consent with 400", async () => {
    const res = await client.request(`/api/v1/me/opportunity-comparisons/${comparisonId}/explanations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-expl-key-00000001",
      },
      body: JSON.stringify({
        consent: false,
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("creates explanation for comparison returning 201 with deterministic feasibility and summary", async () => {
    const res = await client.request(`/api/v1/me/opportunity-comparisons/${comparisonId}/explanations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-expl-key-00000001",
      },
      body: JSON.stringify({
        consent: true,
        answers: [],
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    const expl = body.data;

    expect(expl.id).toBeDefined();
    expect(expl.comparison_id).toBe(comparisonId);
    expect(expl.agent_id).toBe("A03");
    expect(expl.contract_version).toBe("agent-result/1");
    expect(expl.status).toBe("completed");
    expect(expl.summary).toContain("Auxiliar de Bodega e Inventario");
    expect(expl.decision.feasibility).toBe("VIABLE");
    expect(Array.isArray(expl.questions)).toBe(true);
  });

  it("replays POST explanation with same Idempotency-Key returning 200 with saved explanation", async () => {
    const res = await client.request(`/api/v1/me/opportunity-comparisons/${comparisonId}/explanations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-expl-key-00000001",
      },
      body: JSON.stringify({
        consent: true,
        answers: [],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.comparison_id).toBe(comparisonId);
  });

  it("rejects POST explanation with same Idempotency-Key but different answers with 409", async () => {
    const res = await client.request(`/api/v1/me/opportunity-comparisons/${comparisonId}/explanations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-expl-key-00000001",
      },
      body: JSON.stringify({
        consent: true,
        answers: [{ field: "commute_minutes", text: "Tengo disponibilidad inmediata" }],
      }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("retrieves explanation via GET /me/opportunity-comparisons/:id/explanations", async () => {
    const res = await client.request(`/api/v1/me/opportunity-comparisons/${comparisonId}/explanations`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.comparison_id).toBe(comparisonId);
    expect(body.data.agent_id).toBe("A03");
  });

  it("denies access to explanation across tenants returning 404 (CASE-D3-14)", async () => {
    const userBToken = authFixture.tokens.b;

    const res = await client.request(`/api/v1/me/opportunity-comparisons/${comparisonId}/explanations`, {
      headers: {
        Authorization: `Bearer ${userBToken}`,
      },
    });

    expect(res.status).toBe(404);
  });

  it("Finding 1: POST /me/opportunity-comparisons transports real schedule and returns INVIABLE on schedule collision", async () => {
    // Vacancy requires weekend work (Sábado a Domingo 08:00 - 17:00), User A works Monday to Friday
    const oppWeekendId = "a0000000-0000-4000-8000-000000000088";
    await dbFixture.admin.query(`
      INSERT INTO app."Opportunity" (
        "id", "organizationId", "title", "description", "occupationId", "catalogVersionId",
        "location", "workplaceType", "salaryAmount", "salaryCurrency", "salaryPeriod",
        "scheduleSummary", "availableSlots", "active", "isDemo", "version", "publishedAt"
      ) VALUES (
        '${oppWeekendId}', '${companyOrgId}', 'Auxiliar Fin de Semana',
        'Puesto con horario fijo sábado y domingo.',
        '${occupationId}', '${catalogVersionId}', 'Costa del Este',
        'ON_SITE', 700.00, 'USD', 'MONTH', 'Sábado a Domingo 08:00 - 17:00',
        1, true, true, 1, NOW()
      ) ON CONFLICT DO NOTHING;
    `);

    const res = await client.request("/api/v1/me/opportunity-comparisons", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-idem-sched-collision-01",
      },
      body: JSON.stringify({
        opportunity_id: oppWeekendId,
        assumptions: { commute_minutes: 20 },
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.breakdown.logistics.schedule.status).toBe("NO_CUMPLE");
    expect(body.data.status).toBe("INVIABLE");
  });

  it("Finding 2: POST /me/opportunity-comparisons marks absent essential skill as DESCONOCIDO and PENDIENTE despite other confirmed skills", async () => {
    // Vacancy requires Inventory (which User A has) AND Forklift (which User A has NO claim for)
    const oppMissingSkillId = "a0000000-0000-4000-8000-000000000089";
    await dbFixture.admin.query(`
      INSERT INTO app."Opportunity" (
        "id", "organizationId", "title", "description", "occupationId", "catalogVersionId",
        "location", "workplaceType", "salaryAmount", "salaryCurrency", "salaryPeriod",
        "scheduleSummary", "availableSlots", "active", "isDemo", "version", "publishedAt"
      ) VALUES (
        '${oppMissingSkillId}', '${companyOrgId}', 'Operador con Montacargas Requerido',
        'Requiere inventario y montacargas esencial.',
        '${occupationId}', '${catalogVersionId}', 'Juan Díaz',
        'ON_SITE', 700.00, 'USD', 'MONTH', 'Lunes a Viernes 08:00 - 17:00',
        1, true, true, 1, NOW()
      ) ON CONFLICT DO NOTHING;

      INSERT INTO app."OpportunityRequirement" (
        "id", "opportunityId", "competencyId", "catalogVersionId", "requirementType", "stage", "description"
      ) VALUES
        (gen_random_uuid(), '${oppMissingSkillId}', '${competency1Id}', '${catalogVersionId}', 'ESSENTIAL', 'ENTRY', 'Inventario'),
        (gen_random_uuid(), '${oppMissingSkillId}', '${competency2Id}', '${catalogVersionId}', 'ESSENTIAL', 'ENTRY', 'Montacargas esencial')
      ON CONFLICT DO NOTHING;
    `);

    const res = await client.request("/api/v1/me/opportunity-comparisons", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-idem-absent-skill-01",
      },
      body: JSON.stringify({
        opportunity_id: oppMissingSkillId,
        assumptions: { commute_minutes: 20 },
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    // Absent skill MUST be DESCONOCIDO, not NO_CUMPLE, and feasibility must be PENDIENTE, not INVIABLE
    expect(body.data.status).toBe("PENDIENTE");
    const req2 = body.data.breakdown.requirements.find((r: any) => r.competency_id === competency2Id);
    expect(req2.status).toBe("DESCONOCIDO");
  });
});


