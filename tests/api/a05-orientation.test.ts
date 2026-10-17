import { it, expect, describe, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { CoursesService } from "../../apps/api/src/modules/courses/courses.service";
import { PlanningService } from "../../apps/api/src/modules/planning/planning.service";
import { AgentA05Service, type AgentA05Runner } from "../../apps/api/src/modules/planning/agent-a05.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";
import { AppError } from "../../apps/api/src/errors";

describe("D4-B Planning & Agent A05 Orientation API (Offline Integration)", () => {
  let dbFixture: DatabaseFixture;
  let authFixture: AuthFixture;
  let client: ReturnType<typeof createApp>;
  let userAToken: string;
  let userBToken: string;
  let mockA05RunnerShouldFail = false;

  const trainingCenterOrgId = "90000000-0000-4000-8000-000000000010";
  const employerOrgId = "90000000-0000-4000-8000-000000000011";
  const catalogVersionId = "c0000000-0000-4000-8000-000000000010";
  const competency1Id = "11111111-0000-4000-8000-000000000010";
  const competency2Id = "22222222-0000-4000-8000-000000000020";

  const oppId = "80000000-0000-4000-8000-000000000010";
  const course1Id = "c1000000-0000-4000-8000-000000000010";
  const version1Id = "b1000000-0000-4000-8000-000000000010";
  const edition1Id = "e1000000-0000-4000-8000-000000000010";

  let createdPlanId: string;

  beforeAll(async () => {
    dbFixture = await setupTestDatabase();
    authFixture = startAuthFixture(55443);

    const config = {
      ...dbFixture.config,
      supabaseUrl: authFixture.url,
      allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
    };

    const identityService = new IdentityService(dbFixture.db);
    const profileService = new ProfileService(dbFixture.db);
    const coursesService = new CoursesService(dbFixture.db);

    const mockRunner: AgentA05Runner = async (input) => {
      if (mockA05RunnerShouldFail) {
        throw new Error("Simulated Vertex AI 503 Provider Failure");
      }
      return {
        id: "mock-exp-1",
        plan_id: input.planId,
        agent_id: "A05",
        contract_version: "agent-result/1",
        status: "completed",
        summary: "Tu plan cubre la competencia de inventarios y los horarios coinciden con tu disponibilidad de sábado.",
        decision: {
          code: "ROUTE_EXPLAINED",
          feasibility: "VIABLE",
          reasons: ["Compatible con presupuesto y disponibilidad"],
        },
        missing_fields: [],
        questions: [],
        created_at: new Date().toISOString(),
      };
    };

    const agentA05 = new AgentA05Service(dbFixture.db, mockRunner);
    const planningService = new PlanningService(dbFixture.db, agentA05);
    const verifyToken = createVerifyToken(config);

    client = createApp({
      identityService,
      profileService,
      coursesService,
      planningService,
      verifyToken,
      allowedOrigins: config.allowedOrigins,
    });

    userAToken = authFixture.tokens.a;
    userBToken = authFixture.tokens.b;

    // Bootstrap Users
    await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userAToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await client.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userAToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

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

    // Seed Catalog, Competencies, Organizations, Opportunity, Course and Editions
    await dbFixture.admin.query(`
      INSERT INTO app."CatalogVersion" ("id", "code", "sourceLabel")
      VALUES ('${catalogVersionId}', 'CAT-PA-2026-PLAN', 'Catálogo de Planificación')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CompetencyEntry" ("id", "catalogVersionId", "code", "name", "description", "kind")
      VALUES
        ('${competency1Id}', '${catalogVersionId}', 'SKILL-INV', 'Gestión de Inventarios', 'Manejo de kardex', 'SKILL'),
        ('${competency2Id}', '${catalogVersionId}', 'KNOW-MATH', 'Matemática básica', 'Operaciones aritméticas', 'KNOWLEDGE')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Organization" ("id", "name", "type", "active", "updatedAt")
      VALUES
        ('${employerOrgId}', 'Logística del Istmo S.A.', 'COMPANY', true, NOW()),
        ('${trainingCenterOrgId}', 'Instituto Técnico Profesional', 'TRAINING_CENTER', true, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."OccupationEntry" ("id", "catalogVersionId", "code", "name", "description", "active")
      VALUES ('70000000-0000-4000-8000-000000000010', '${catalogVersionId}', 'OCC-BOD', 'Auxiliar de Bodega', 'Almacén', true)
      ON CONFLICT DO NOTHING;

      -- Vacante que exige SKILL-INV
      INSERT INTO app."Opportunity" ("id", "organizationId", "occupationId", "catalogVersionId", "title", "description", "workplaceType", "location", "active", "isDemo", "version", "updatedAt")
      VALUES ('${oppId}', '${employerOrgId}', '70000000-0000-4000-8000-000000000010', '${catalogVersionId}', 'Auxiliar de Almacén', 'Vacante demo', 'ON_SITE', 'Panamá', true, true, 1, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."OpportunityRequirement" ("id", "opportunityId", "competencyId", "catalogVersionId", "requirementType", "stage", "description")
      VALUES ('91000000-0000-4000-8000-000000000010', '${oppId}', '${competency1Id}', '${catalogVersionId}', 'ESSENTIAL', 'ENTRY', 'Requerido para puesto')
      ON CONFLICT DO NOTHING;

      -- Curso que enseña SKILL-INV y pide KNOW-MATH
      INSERT INTO app."Course" ("id", "organizationId", "code", "title", "description", "active", "isDemo", "updatedAt")
      VALUES ('${course1Id}', '${trainingCenterOrgId}', 'CUR-INV-DEMO', 'Gestión y Control de Almacén', 'Curso técnico', true, true, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseVersion" ("id", "courseId", "catalogVersionId", "versionNumber", "syllabusText", "durationHours")
      VALUES ('${version1Id}', '${course1Id}', '${catalogVersionId}', 1, 'Módulo 1: Inventario', 40)
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseLearningOutcome" ("id", "courseVersionId", "competencyId", "catalogVersionId", "description")
      VALUES ('92000000-0000-4000-8000-000000000010', '${version1Id}', '${competency1Id}', '${catalogVersionId}', 'Dominio de kardex')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CoursePrerequisite" ("id", "courseVersionId", "competencyId", "catalogVersionId", "essential", "description")
      VALUES ('93000000-0000-4000-8000-000000000010', '${version1Id}', '${competency2Id}', '${catalogVersionId}', true, 'Matemática básica requerida')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseEdition" ("id", "courseVersionId", "modality", "location", "startDate", "endDate", "totalSlots", "availableSlots", "costAmount", "costCurrency", "costPeriod", "scheduleSummary", "active", "isDemo", "version", "updatedAt")
      VALUES ('${edition1Id}', '${version1Id}', 'ON_SITE', 'Sede Central', CURRENT_DATE + 5, CURRENT_DATE + 25, 10, 10, 30.00, 'USD', 'TOTAL', 'Sábados 08:00 - 12:00', true, true, 1, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseSession" ("id", "editionId", "weekday", "startMinute", "endMinute", "timezone", "location")
      VALUES ('94000000-0000-4000-8000-000000000010', '${edition1Id}', 6, 480, 720, 'America/Panama', 'Aula 101')
      ON CONFLICT DO NOTHING;
    `);

    // Crear perfil confirmado para User A con KNOW-MATH demostrada, para que pueda tomar el curso
    const userARow = await dbFixture.admin.query(
      `SELECT "id" FROM app."AppUser" WHERE "authSubject" = '${authFixture.users.a.id}'`
    );
    const userAId = userARow.rows[0].id;

    const profileARow = await dbFixture.admin.query(
      `SELECT "id" FROM app."CandidateProfile" WHERE "ownerUserId" = '${userAId}'`
    );
    const profileAId = profileARow.rows[0].id;
    const revId = "f1000000-0000-4000-8000-000000000010";

    await dbFixture.admin.query(`
      ALTER TABLE app."ProfileRevision" DISABLE TRIGGER ALL;
      ALTER TABLE app."CandidateProfile" DISABLE TRIGGER ALL;

      INSERT INTO app."ProfileRevision" (
        "id", "profileId", "status", "revision", "displayName", "headline", "updatedAt"
      ) VALUES (
        '${revId}', '${profileAId}', 'DRAFT', 1, 'Candidato Demo A', 'Aspirante Bodega', NOW()
      ) ON CONFLICT DO NOTHING;

      WITH new_src AS (
        INSERT INTO app."ProfileSource" (
          "id", "profileId", "kind", "status", "sha256", "mediaType", "sizeBytes", "manualText"
        ) VALUES (
          gen_random_uuid(), '${profileAId}', 'MANUAL_TEXT', 'READY', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'text/plain', 50, 'Certificado de matemáticas'
        ) RETURNING id
      ),
      new_frag AS (
        INSERT INTO app."SourceFragment" (
          "id", "profileId", "sourceId", "text"
        ) SELECT gen_random_uuid(), '${profileAId}', id, 'Certificado de matemáticas' FROM new_src
        RETURNING id
      ),
      new_ev AS (
        INSERT INTO app."ProfileEvidence" (
          "id", "profileId", "fragmentId", "kind", "scope"
        ) SELECT gen_random_uuid(), '${profileAId}', id, 'DOCUMENT', 'Evidencia de matemáticas' FROM new_frag
        RETURNING id
      ),
      new_claim AS (
        INSERT INTO app."CompetencyClaim" (
          "id", "profileId", "revisionId", "competencyId", "catalogVersionId",
          "originalText", "criterion", "decision"
        ) VALUES (
          gen_random_uuid(), '${profileAId}', '${revId}', '${competency2Id}', '${catalogVersionId}',
          'Sé matemáticas básicas', 'Aprobado', 'ACCEPTED'
        ) RETURNING id
      )
      INSERT INTO app."ProfileEvidenceLink" (
        "id", "profileId", "revisionId", "evidenceId", "claimId"
      ) VALUES (
        gen_random_uuid(), '${profileAId}', '${revId}', (SELECT id FROM new_ev), (SELECT id FROM new_claim)
      );

      -- Presupuesto de capacitación $100 y disponibilidad los sábados
      INSERT INTO app."ProfileConstraints" ("id", "profileId", "revisionId", "trainingBudget", "trainingCurrency", "trainingPeriod", "trainingState", "availabilityState")
      VALUES ('c1000000-0000-4000-8000-000000000010', '${profileAId}', '${revId}', 100.00, 'USD', 'TOTAL', 'KNOWN', 'KNOWN')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."AvailabilityWindow" ("id", "profileId", "revisionId", "weekday", "startMinute", "endMinute", "validFrom", "validTo")
      VALUES (gen_random_uuid(), '${profileAId}', '${revId}', 6, 420, 1080, CURRENT_DATE, CURRENT_DATE + 90)
      ON CONFLICT DO NOTHING;

      UPDATE app."ProfileRevision" SET
        "status" = 'CONFIRMED',
        "versionNumber" = 1,
        "confirmedAt" = NOW(),
        "confirmedById" = '${userAId}',
        "snapshotDigest" = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      WHERE "id" = '${revId}';

      UPDATE app."CandidateProfile" SET "currentVersionId" = '${revId}' WHERE "id" = '${profileAId}';

      ALTER TABLE app."ProfileRevision" ENABLE TRIGGER ALL;
      ALTER TABLE app."CandidateProfile" ENABLE TRIGGER ALL;
    `);
  });

  afterAll(async () => {
    authFixture.server.stop();
    await dbFixture.db.close();
  });

  it("POST /me/learning-plans/preview calculates C01 route and persists plan in state CALCULATED", async () => {
    const res = await client.request("/api/v1/me/learning-plans/preview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "preview-test-plan-key-0001",
      },
      body: JSON.stringify({
        target_opportunity_id: oppId,
        assumptions: {
          commute_minutes: 30,
          max_budget_amount: "50.00",
        },
      }),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe("CALCULATED");
    expect(body.data.feasibility).toBe("VIABLE");
    expect(body.data.coverage_numerator).toBe(1);
    expect(body.data.coverage_denominator).toBe(1);
    expect(body.data.steps.length).toBe(1);
    expect(body.data.steps[0].edition_id).toBe(edition1Id);
    expect(body.data.steps[0].step_type).toBe("DIRECT");

    createdPlanId = body.data.id;
  });

  it("POST /me/learning-plans/:id/confirmations confirms the plan without reserving editions", async () => {
    // 1. Verificar cupos antes de confirmar
    const editionBefore = await dbFixture.admin.query(
      `SELECT "availableSlots", "totalSlots" FROM app."CourseEdition" WHERE "id" = '${edition1Id}'`
    );
    const slotsBefore = editionBefore.rows[0].availableSlots;

    // 2. Confirmar plan
    const res = await client.request(`/api/v1/me/learning-plans/${createdPlanId}/confirmations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.status).toBe("CONFIRMED");
    expect(body.data.confirmed_at).toBeDefined();

    // 3. CRUCIAL: Verificar que las plazas disponibles NO cambiaron y NO hay reserva
    const editionAfter = await dbFixture.admin.query(
      `SELECT "availableSlots", "totalSlots" FROM app."CourseEdition" WHERE "id" = '${edition1Id}'`
    );
    expect(editionAfter.rows[0].availableSlots).toBe(slotsBefore);

    const reservationsCount = await dbFixture.admin.query(
      `SELECT COUNT(*) FROM app."CourseReservation" WHERE "editionId" = '${edition1Id}'`
    );
    expect(Number(reservationsCount.rows[0].count)).toBe(0);
  });

  it("POST /me/learning-plans/:id/explanations requires explicit consent", async () => {
    const res = await client.request(`/api/v1/me/learning-plans/${createdPlanId}/explanations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        consent: false,
      }),
    });

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error.code).toBe("CONSENT_REQUIRED");
  });

  it("POST /me/learning-plans/:id/explanations dispatches Agent A05 and records explanation", async () => {
    const res = await client.request(`/api/v1/me/learning-plans/${createdPlanId}/explanations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        consent: true,
        answers: [{ field: "transporte", text: "Me desplazo en metro" }],
      }),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.data.agent_id).toBe("A05");
    expect(body.data.status).toBe("completed");
    expect(body.data.summary).toContain("inventarios");
    expect(body.data.decision.feasibility).toBe("VIABLE");
  });

  it("POST /me/learning-plans/:id/explanations returns 503 VERTEX_UNAVAILABLE on provider failure without modifying C01 plan", async () => {
    mockA05RunnerShouldFail = true;

    try {
      const res = await client.request(`/api/v1/me/learning-plans/${createdPlanId}/explanations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          consent: true,
        }),
      });

      expect(res.status).toBe(503);
      const body: any = await res.json();
      expect(body.error.code).toBe("VERTEX_UNAVAILABLE");

      // Verificar que el plan C01 sigue intacto en base de datos
      const planQuery = await dbFixture.admin.query(
        `SELECT "status", "feasibility" FROM app."LearningPlan" WHERE "id" = '${createdPlanId}'`
      );
      expect(planQuery.rows[0].status).toBe("CONFIRMED");
      expect(planQuery.rows[0].feasibility).toBe("VIABLE");
    } finally {
      mockA05RunnerShouldFail = false;
    }
  });

  it("GET /me/learning-plans and /:id returns stored plan with correct status", async () => {
    const res = await client.request(`/api/v1/me/learning-plans/${createdPlanId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.id).toBe(createdPlanId);
    expect(body.data.status).toBe("CONFIRMED");
    expect(body.data.outdated).toBe(false);
  });

  it("denies access to User B attempting to view or confirm User A's plan (404)", async () => {
    const res = await client.request(`/api/v1/me/learning-plans/${createdPlanId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userBToken}` },
    });

    expect(res.status).toBe(404);
  });
});
