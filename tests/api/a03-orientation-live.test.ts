import { it, expect, describe, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { OpportunitiesService } from "../../apps/api/src/modules/opportunities/opportunities.service";
import { AgentA03Service } from "../../apps/api/src/modules/opportunities/agent-a03.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";
import { OpportunityExplanationViewSchema } from "@equipo10/contracts";

describe("Live Vertex AI Evaluation for Agent A03", () => {
  let dbFixture: DatabaseFixture;
  let authFixture: AuthFixture;
  let userToken: string;
  let actorUserId: string;
  let comparisonId: string;
  let a03Service: AgentA03Service;

  beforeAll(async () => {
    if (process.env.RUN_VERTEX_A03_EVAL !== "1") {
      return;
    }

    dbFixture = await setupTestDatabase();
    authFixture = startAuthFixture(55441);

    const config = {
      ...dbFixture.config,
      supabaseUrl: authFixture.url,
      allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
    };

    const identityService = new IdentityService(dbFixture.db);
    const profileService = new ProfileService(dbFixture.db);
    a03Service = new AgentA03Service(dbFixture.db);
    const opportunitiesService = new OpportunitiesService(dbFixture.db, a03Service);
    const verifyToken = createVerifyToken(config);

    const client = createApp({
      identityService,
      profileService,
      opportunitiesService,
      verifyToken,
      allowedOrigins: config.allowedOrigins,
    });

    userToken = authFixture.tokens.a;

    // 1. Bootstrap User A and CandidateProfile
    await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    await client.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const catalogVersionId = "c0000000-0000-4000-8000-000000000001";
    const occupationId = "0a000000-0000-4000-8000-000000000001";
    const competency1Id = "11111111-0000-4000-8000-000000000001";
    const competency2Id = "22222222-0000-4000-8000-000000000002";
    const companyOrgId = "90000000-0000-4000-8000-000000000001";
    const testOppId = "a0000000-0000-4000-8000-000000000099";

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
        (gen_random_uuid(), '${testOppId}', '${competency2Id}', '${catalogVersionId}', 'DESIRABLE', 'TRAINABLE', 'Operación de transpaleta')
      ON CONFLICT DO NOTHING;
    `);

    // Create draft for User A
    const resDraft = await client.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-live-draft-0000001",
      },
      body: JSON.stringify({}),
    });
    const draftId = ((await resDraft.json()) as any).data.id;

    await client.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json", "If-Match": "1" },
      body: JSON.stringify({
        section: "identity",
        values: { display_name: "Candidato Sintético Demo" },
      }),
    });

    await client.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json", "If-Match": "2" },
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
    const profileId = profRow.rows[0].id;
    actorUserId = profRow.rows[0].ownerUserId;

    // Add accepted claim and availability windows
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

    for (const section of ["ACCOUNT", "EXPERIENCE", "TRAINING", "INTERESTS", "COMPETENCIES", "AVAILABILITY", "CONSTRAINTS", "FINAL_REVIEW"]) {
      await client.request("/api/v1/me/candidate-profile/draft/section-reviews", {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json", "Idempotency-Key": `rev-live-${section.toLowerCase()}-001` },
        body: JSON.stringify({ section, decision: "REVIEWED" }),
      });
    }

    const resPreview = await client.request("/api/v1/me/candidate-profile/draft/review-previews", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json", "If-Match": "3", "Idempotency-Key": "test-preview-key-live-01" },
      body: JSON.stringify({}),
    });
    const previewId = ((await resPreview.json()) as any).data.preview_id;

    const draftCur = await client.request("/api/v1/me/candidate-profile/draft", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const curRev = ((await draftCur.json()) as any).data.revision;

    await client.request("/api/v1/me/candidate-profile/confirmations", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json", "If-Match": String(curRev), "Idempotency-Key": "test-confirm-key-live-01" },
      body: JSON.stringify({ draft_id: draftId, preview_id: previewId, acknowledge_partial: true }),
    });

    const resComp = await client.request("/api/v1/me/opportunity-comparisons", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json", "Idempotency-Key": "test-idem-live-comp-001" },
      body: JSON.stringify({ opportunity_id: testOppId, assumptions: { commute_minutes: 30 } }),
    });
    comparisonId = ((await resComp.json()) as any).data.id;
  });

  afterAll(async () => {
    if (authFixture) authFixture.stop();
    if (dbFixture) await dbFixture.close();
  });

  it.skipIf(process.env.RUN_VERTEX_A03_EVAL !== "1")(
    "Agent A03 executes autonomous loop in Vertex AI using Gemini 3.8 Flash with ADC and tools",
    async () => {
      const startTime = Date.now();
      const result = await a03Service.explainComparison({
        comparisonId,
        actorUserId,
        consent: true,
        answers: [
          { field: "commute_minutes", text: "Mi tiempo estimado de viaje es de 35 minutos tomando el metro." },
        ],
      });
      const durationMs = Date.now() - startTime;

      expect(result.provider).toBe("vertex-gemini-3.8-flash");
      expect(result.explanation).toBeDefined();
      expect(result.explanation.agent_id).toBe("A03");
      expect(result.explanation.contract_version).toBe("agent-result/1");
      expect(result.explanation.status).toBe("completed");
      expect(result.explanation.decision.feasibility).toBe("VIABLE");
      expect(result.explanation.summary.length).toBeGreaterThan(50);

      // Validate schema compliance
      const parsed = OpportunityExplanationViewSchema.safeParse(result.explanation);
      expect(parsed.success).toBe(true);
      expect(Array.isArray(result.toolsInvoked)).toBe(true);
      expect(result.toolsInvoked).toContain("submit_explanation");

      console.log("[LIVE TEST RESULT] A03 Vertex AI Execution Summary:", JSON.stringify({
        provider: result.provider,
        model: "gemini-3.8-flash",
        feasibility: result.explanation.decision.feasibility,
        decisionCode: result.explanation.decision.code,
        summaryPreview: result.explanation.summary.slice(0, 160) + "...",
        missingFieldsCount: result.explanation.missing_fields.length,
        questionsCount: result.explanation.questions.length,
        toolsInvoked: result.toolsInvoked,
        durationSeconds: (durationMs / 1000).toFixed(2),
      }, null, 2));
    },
    125000
  );
});
