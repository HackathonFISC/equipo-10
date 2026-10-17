import { describe, it, expect, beforeAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { OpportunitiesService } from "../../apps/api/src/modules/opportunities/opportunities.service";
import { AgentA03Service } from "../../apps/api/src/modules/opportunities/agent-a03.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";
import { OpportunityExplanationViewSchema } from "@equipo10/contracts";

describe("D3-4 Agent A03 Autonomous Orientation and Tools", () => {
  let dbFixture: DatabaseFixture;
  let authFixture: AuthFixture;
  let client: ReturnType<typeof createApp>;
  let userToken: string;

  let a03Service: AgentA03Service;
  let opportunitiesService: OpportunitiesService;

  let actorUserId: string;
  let profileId: string;
  let revisionId: string;
  let opportunityId: string;
  let comparisonId: string;

  const catalogVersionId = "c0000000-0000-4000-8000-000000000001";
  const occupationId = "0a000000-0000-4000-8000-000000000001";
  const competency1Id = "11111111-0000-4000-8000-000000000001";
  const competency2Id = "22222222-0000-4000-8000-000000000002";
  const companyOrgId = "90000000-0000-4000-8000-000000000001";
  const testOppId = "a0000000-0000-4000-8000-000000000099";

  beforeAll(async () => {
    dbFixture = await setupTestDatabase();
    authFixture = startAuthFixture(55440);

    const config = {
      ...dbFixture.config,
      supabaseUrl: authFixture.url,
      allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
    };

    const identityService = new IdentityService(dbFixture.db);
    const profileService = new ProfileService(dbFixture.db);
    a03Service = new AgentA03Service(dbFixture.db);
    opportunitiesService = new OpportunitiesService(dbFixture.db, a03Service);
    const verifyToken = createVerifyToken(config);

    client = createApp({
      identityService,
      profileService,
      opportunitiesService,
      verifyToken,
      allowedOrigins: config.allowedOrigins,
    });

    userToken = authFixture.tokens.a;

    // 1. Bootstrap User A and CandidateProfile
    const resA = await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resA.status).toBe(200);

    const profRes = await client.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(profRes.status).toBe(200);

    // Seed Catalog, Occupation, Competencies, Organization, and Opportunity
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
      VALUES ('${companyOrgId}', 'Distribuidora Central S.A.', 'COMPANY', true, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Opportunity" (
        "id", "organizationId", "title", "description", "occupationId", "catalogVersionId",
        "location", "workplaceType", "salaryAmount", "salaryCurrency", "salaryPeriod",
        "scheduleSummary", "availableSlots", "active", "isDemo", "version", "publishedAt"
      ) VALUES (
        '${testOppId}', '${companyOrgId}', 'Auxiliar de Bodega',
        'Encargado de inventarios y preparación de pedidos.',
        '${occupationId}', '${catalogVersionId}', 'Parque Industrial Costa del Este',
        'ON_SITE', 700.00, 'USD', 'MONTH', 'Lunes a Viernes 08:00 - 17:00',
        2, true, true, 1, NOW()
      ) ON CONFLICT DO NOTHING;

      INSERT INTO app."OpportunityRequirement" (
        "id", "opportunityId", "competencyId", "catalogVersionId", "requirementType", "stage", "description"
      ) VALUES
        (gen_random_uuid(), '${testOppId}', '${competency1Id}', '${catalogVersionId}', 'ESSENTIAL', 'ENTRY', 'Manejo de kardex e inventarios'),
        (gen_random_uuid(), '${testOppId}', '${competency2Id}', '${catalogVersionId}', 'ESSENTIAL', 'TRAINABLE', 'Operación de transpaleta')
      ON CONFLICT DO NOTHING;
    `);

    opportunityId = testOppId;

    // 2. Create and patch draft
    const resDraft = await client.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-a03-draft-0000001",
      },
      body: JSON.stringify({}),
    });
    expect(resDraft.status).toBe(201);
    const draftBody = (await resDraft.json()) as any;
    const draftId = draftBody.data.id;

    await client.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "If-Match": "1",
      },
      body: JSON.stringify({
        section: "identity",
        values: { display_name: "Giovanny Candidato" },
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
          max_one_way_minutes: 45,
          location_state: "KNOWN",
          approximate_zone: "Ciudad de Panamá",
          availability_state: "KNOWN",
          mobility_state: "UNKNOWN",
          transport_state: "UNKNOWN",
          training_state: "UNKNOWN",
        },
      }),
    });

    const profRow = await dbFixture.admin.query<{ id: string; ownerUserId: string }>(
      `SELECT "id", "ownerUserId" FROM app."CandidateProfile" WHERE "ownerUserId" = (SELECT id FROM app."AppUser" WHERE "authSubject" = $1)`,
      [authFixture.users.a.id]
    );
    profileId = profRow.rows[0].id;
    actorUserId = profRow.rows[0].ownerUserId;

    // Add accepted claim with evidence and availability windows
    await dbFixture.admin.query(`
      WITH new_src AS (
        INSERT INTO app."ProfileSource" (
          "id", "profileId", "kind", "status", "sha256", "mediaType", "sizeBytes", "manualText"
        ) VALUES (
          gen_random_uuid(), '${profileId}', 'MANUAL_TEXT', 'READY', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'text/plain', 50, 'Registro de inventario'
        ) RETURNING id
      ),
      new_frag AS (
        INSERT INTO app."SourceFragment" (
          "id", "profileId", "sourceId", "text"
        ) SELECT gen_random_uuid(), '${profileId}', id, 'Registro de inventario' FROM new_src
        RETURNING id
      ),
      new_ev AS (
        INSERT INTO app."ProfileEvidence" (
          "id", "profileId", "fragmentId", "kind", "scope"
        ) SELECT gen_random_uuid(), '${profileId}', id, 'DOCUMENT', 'Evidencia de bodega' FROM new_frag
        RETURNING id
      ),
      new_claim AS (
        INSERT INTO app."CompetencyClaim" (
          "id", "profileId", "revisionId", "competencyId", "catalogVersionId",
          "originalText", "criterion", "decision"
        ) VALUES (
          gen_random_uuid(), '${profileId}', '${draftId}', '${competency1Id}', '${catalogVersionId}',
          'Manejo de existencias', 'Inventario', 'ACCEPTED'
        ) RETURNING id
      )
      INSERT INTO app."ProfileEvidenceLink" (
        "id", "profileId", "revisionId", "evidenceId", "claimId"
      ) VALUES (
        gen_random_uuid(), '${profileId}', '${draftId}', (SELECT id FROM new_ev), (SELECT id FROM new_claim)
      );

      INSERT INTO app."AvailabilityWindow" (
        "id", "profileId", "revisionId", "weekday", "startMinute", "endMinute", "timezone", "validFrom", "validTo"
      ) VALUES
        (gen_random_uuid(), '${profileId}', '${draftId}', 1, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${profileId}', '${draftId}', 2, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${profileId}', '${draftId}', 3, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${profileId}', '${draftId}', 4, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${profileId}', '${draftId}', 5, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year');
    `);

    // Complete reviews and confirm
    for (const section of ["ACCOUNT", "EXPERIENCE", "TRAINING", "INTERESTS", "COMPETENCIES", "AVAILABILITY", "CONSTRAINTS", "FINAL_REVIEW"]) {
      await client.request("/api/v1/me/candidate-profile/draft/section-reviews", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `rev-a03-${section.toLowerCase()}-001`,
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
        "Idempotency-Key": "test-preview-key-a03-01",
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
        "Idempotency-Key": "test-confirm-key-a03-01",
      },
      body: JSON.stringify({
        draft_id: draftId,
        preview_id: previewId,
        acknowledge_partial: true,
      }),
    });
    expect(resConfirm.status).toBe(201);
    revisionId = draftId;

    // 3. Create comparison
    const resComp = await client.request("/api/v1/me/opportunity-comparisons", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-idem-a03-comp-001",
      },
      body: JSON.stringify({
        opportunity_id: opportunityId,
        assumptions: {
          commute_minutes: 30,
        },
      }),
    });
    expect(resComp.status).toBe(201);
    const compBody = (await resComp.json()) as any;
    comparisonId = compBody.data.id;
  });

  it("Tool 1: read_confirmed_profile returns candidate data and confirmed claims", async () => {
    const data = await a03Service.toolReadConfirmedProfile(profileId, revisionId, actorUserId);
    expect(data.error).toBeUndefined();
    expect(data.display_name).toBe("Giovanny Candidato");
    expect(data.confirmed_competencies.length).toBe(1);
    expect(data.confirmed_competencies[0].competency_id).toBe(competency1Id);
    expect(data.constraints.minimum_salary).toBe("600");
    expect(data.constraints.max_one_way_minutes).toBe(45);
  });

  it("Tool 2: read_vacancy returns full vacancy details and requirements breakdown", async () => {
    const data = await a03Service.toolReadVacancy(opportunityId, actorUserId);
    expect(data.error).toBeUndefined();
    expect(data.title).toBe("Auxiliar de Bodega");
    expect(data.organization).toBe("Distribuidora Central S.A.");
    expect(data.requirements.length).toBe(2);
    expect(data.requirements[0].stage).toBe("ENTRY");
    expect(data.requirements[1].stage).toBe("TRAINABLE");
  });

  it("Tool 3: evaluate_compatibility invokes internal C01 engine correctly", async () => {
    const result = await a03Service.toolEvaluateCompatibility(opportunityId, actorUserId, {
      commute_minutes: 30,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe("VIABLE");
    expect(result.coverageNumerator).toBe(1);
    expect(result.coverageDenominator).toBe(2);
    expect(result.breakdown.logistics.salary.status).toBe("CUMPLE");
    expect(result.breakdown.logistics.commute.status).toBe("CUMPLE");
  });

  it("Tool 4: read_comparison_trace retrieves stored comparison trace", async () => {
    const data = await a03Service.toolReadComparisonTrace(comparisonId, actorUserId);
    expect(data).not.toBeNull();
    expect(data?.id).toBe(comparisonId);
    expect(data?.status).toBe("VIABLE");
    expect(data?.coverage_numerator).toBe(1);
    expect(data?.coverage_denominator).toBe(2);
  });

  it("Finding 6: Eliminates silent fallback: throws recoverable 503 VERTEX_UNAVAILABLE when Vertex is disabled or fails", async () => {
    process.env.VERTEX_DISABLED = "true";
    try {
      let errorThrown: any = null;
      try {
        await a03Service.explainComparison({
          comparisonId,
          actorUserId,
          consent: true,
          answers: [],
        });
      } catch (err: any) {
        errorThrown = err;
      }
      expect(errorThrown).not.toBeNull();
      expect(errorThrown.status).toBe(503);
      expect(errorThrown.code).toBe("VERTEX_UNAVAILABLE");
    } finally {
      delete process.env.VERTEX_DISABLED;
    }
  });

  it("Finding 5: Tool evaluate_compatibility is callable and incorporates clarifications", async () => {
    // Call evaluate_compatibility with commute_minutes override
    const reeval = await a03Service.toolEvaluateCompatibility(opportunityId, actorUserId, {
      commute_minutes: 40,
    });
    expect(reeval.error).toBeUndefined();
    expect(reeval.status).toBe("VIABLE");
    expect(reeval.breakdown.logistics.commute.assumed_minutes).toBe(40);

    // Call evaluate_compatibility with excessive commute minutes
    const reevalExcessive = await a03Service.toolEvaluateCompatibility(opportunityId, actorUserId, {
      commute_minutes: 90,
    });
    expect(reevalExcessive.status).toBe("INVIABLE");
    expect(reevalExcessive.breakdown.logistics.commute.status).toBe("NO_CUMPLE");
  });

  it("Finding 8: Persists explanation, audit event and receipt in a single atomic transaction", async () => {
    // Create an instance of OpportunitiesService with a test runner for controlled testing
    const atomicExpId = "e0000000-0000-4000-8000-000000000001";
    const mockA03Service = new AgentA03Service(dbFixture.db, async (input) => {
      // Simulate autonomous agent reading tools and providing explanation
      const compTrace = await mockA03Service.toolReadComparisonTrace(input.comparisonId, input.actorUserId);
      const vacancy = await mockA03Service.toolReadVacancy(compTrace.opportunity_id, input.actorUserId);

      return {
        id: atomicExpId,
        comparison_id: input.comparisonId,
        agent_id: "A03",
        contract_version: "agent-result/1",
        status: "completed",
        summary: `Tu perfil es viable para el puesto de ${vacancy.title}. Cumples con las competencias esenciales.`,
        decision: {
          code: `FEASIBILITY_${compTrace.status}`,
          feasibility: compTrace.status,
          reasons: compTrace.reasons,
        },
        missing_fields: [],
        questions: [],
        created_at: new Date().toISOString(),
      };
    });

    const oppService = new OpportunitiesService(dbFixture.db, mockA03Service);

    const idempotencyKey = "test-atomic-idem-key-0000001";
    const res = await oppService.createExplanation(
      { id: authFixture.users.a.id } as any,
      comparisonId,
      { consent: true, answers: [{ field: "commute_minutes", text: "35 minutos" }] },
      idempotencyKey
    );

    expect(res.created).toBe(true);
    expect(res.explanation.id).toBe(atomicExpId);
    expect(res.explanation.decision.feasibility).toBe("VIABLE");

    // Verify explanation, audit event and receipt were all saved atomically
    const [expRows, auditRows, receiptRows] = await Promise.all([
      dbFixture.admin.query(`SELECT * FROM app."OpportunityExplanation" WHERE id = '${atomicExpId}'`),
      dbFixture.admin.query(`SELECT * FROM app."AuditEvent" WHERE "actorUserId" = '${actorUserId}' AND "caseId" = 'CU03'`),
      dbFixture.admin.query(`SELECT * FROM app."OperationReceipt" WHERE "actorUserId" = '${actorUserId}' AND "idempotencyKey" = '${idempotencyKey}'`),
    ]);

    expect(expRows.rows.length).toBe(1);
    expect(auditRows.rows.length).toBeGreaterThan(0);
    expect(receiptRows.rows.length).toBe(1);

    // Concurrent / replay test: repeating with same key returns existing without duplicates
    const replayRes = await oppService.createExplanation(
      { id: authFixture.users.a.id } as any,
      comparisonId,
      { consent: true, answers: [{ field: "commute_minutes", text: "35 minutos" }] },
      idempotencyKey
    );
    expect(replayRes.created).toBe(false);
    expect(replayRes.explanation.id).toBe(atomicExpId);

    // Count records again: must NOT have duplicated
    const [expCount, receiptCount] = await Promise.all([
      dbFixture.admin.query(`SELECT COUNT(*) as count FROM app."OpportunityExplanation" WHERE id = '${atomicExpId}'`),
      dbFixture.admin.query(`SELECT COUNT(*) as count FROM app."OperationReceipt" WHERE "idempotencyKey" = '${idempotencyKey}'`),
    ]);
    expect(parseInt(expCount.rows[0].count, 10)).toBe(1);
    expect(parseInt(receiptCount.rows[0].count, 10)).toBe(1);
  });

  it("Finding 8: Intermediate failure during transaction rolls back explanation: never presents success without receipt", async () => {
    const rollbackExpId = "e0000000-0000-4000-8000-000000000002";
    // Construct a service where the DB or receipt fails during the transaction
    const mockA03Service = new AgentA03Service(dbFixture.db, async (input) => {
      return {
        id: rollbackExpId,
        comparison_id: input.comparisonId,
        agent_id: "A03",
        contract_version: "agent-result/1",
        status: "completed",
        summary: "Explicación que debe revertirse si falla la persistencia.",
        decision: { code: "FEASIBILITY_VIABLE", feasibility: "VIABLE", reasons: [] },
        missing_fields: [],
        questions: [],
        created_at: new Date().toISOString(),
      };
    });

    // Mock DB that throws an error inside withActor right after explanation creation
    const failingDb = {
      resolveAuthSubject: dbFixture.db.resolveAuthSubject.bind(dbFixture.db),
      withActor: async <T>(actorId: string, fn: any) => {
        return dbFixture.db.withActor(actorId, async (tx) => {
          // Wrap tx to simulate failure during operation receipt
          (tx.operationReceipt as any).create = async () => {
            throw new Error("Simulated intermediate database failure during receipt generation");
          };
          return fn(tx);
        });
      },
    };

    const failingOppService = new OpportunitiesService(failingDb as any, mockA03Service);

    const idempotencyKey = "test-fail-rollback-key-00001";
    await expect(
      failingOppService.createExplanation(
        { id: authFixture.users.a.id } as any,
        comparisonId,
        { consent: true, answers: [] },
        idempotencyKey
      )
    ).rejects.toThrow();

    // Verify atomic rollback: neither explanation nor receipt exist
    const [expRows, receiptRows] = await Promise.all([
      dbFixture.admin.query(`SELECT * FROM app."OpportunityExplanation" WHERE id = '${rollbackExpId}'`),
      dbFixture.admin.query(`SELECT * FROM app."OperationReceipt" WHERE "idempotencyKey" = '${idempotencyKey}'`),
    ]);

    expect(expRows.rows.length).toBe(0);
    expect(receiptRows.rows.length).toBe(0);
  });

  it("throws AppError 400 when consent is false", async () => {
    expect(
      a03Service.explainComparison({
        comparisonId,
        actorUserId,
        consent: false,
      })
    ).rejects.toThrow("El consentimiento explícito es obligatorio");
  });
});

