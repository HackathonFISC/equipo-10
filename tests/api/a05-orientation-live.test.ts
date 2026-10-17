import { it, expect, describe, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { CoursesService } from "../../apps/api/src/modules/courses/courses.service";
import { PlanningService } from "../../apps/api/src/modules/planning/planning.service";
import { AgentA05Service } from "../../apps/api/src/modules/planning/agent-a05.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";
import { LearningPlanExplanationViewSchema } from "@equipo10/contracts";

describe("Live Vertex AI Evaluation for Agent A05", () => {
  let dbFixture: DatabaseFixture;
  let authFixture: AuthFixture;
  let client: ReturnType<typeof createApp>;
  let userAToken: string;
  let actorUserId: string;
  let planId: string;
  let a05Service: AgentA05Service;

  const trainingCenterOrgId = "90000000-0000-4000-8000-000000000050";
  const employerOrgId = "90000000-0000-4000-8000-000000000051";
  const catalogVersionId = "c0000000-0000-4000-8000-000000000050";
  const competency1Id = "11111111-0000-4000-8000-000000000050";
  const competency2Id = "22222222-0000-4000-8000-000000000051";

  const oppId = "80000000-0000-4000-8000-000000000050";
  const course1Id = "c1000000-0000-4000-8000-000000000050";
  const version1Id = "b1000000-0000-4000-8000-000000000050";
  const edition1Id = "e1000000-0000-4000-8000-000000000050";

  beforeAll(async () => {
    if (process.env.RUN_VERTEX_A05_EVAL !== "1") {
      return;
    }

    dbFixture = await setupTestDatabase();
    authFixture = startAuthFixture(55444);

    const config = {
      ...dbFixture.config,
      supabaseUrl: authFixture.url,
      allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
    };

    const identityService = new IdentityService(dbFixture.db);
    const profileService = new ProfileService(dbFixture.db);
    const coursesService = new CoursesService(dbFixture.db);
    // Real Agent A05 without test mock runner
    a05Service = new AgentA05Service(dbFixture.db);
    const planningService = new PlanningService(dbFixture.db, a05Service);
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

    // 1. Bootstrap User A and CandidateProfile
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

    // 2. Seed catalog, competencies, vacancy, and course
    await dbFixture.admin.query(`
      INSERT INTO app."CatalogVersion" ("id", "code", "sourceLabel")
      VALUES ('${catalogVersionId}', 'CAT-PA-2026-LIVE', 'Catálogo de Planificación Live')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CompetencyEntry" ("id", "catalogVersionId", "code", "name", "description", "kind")
      VALUES
        ('${competency1Id}', '${catalogVersionId}', 'SKILL-INV-LIVE', 'Gestión de Inventarios Avanzada', 'Manejo de existencias y pedidos', 'SKILL'),
        ('${competency2Id}', '${catalogVersionId}', 'KNOW-MATH-LIVE', 'Aritmética y Razonamiento', 'Operaciones básicas de cálculo', 'KNOWLEDGE')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Organization" ("id", "name", "type", "active", "updatedAt")
      VALUES
        ('${employerOrgId}', 'Operadora Logística Transístmica S.A.', 'COMPANY', true, NOW()),
        ('${trainingCenterOrgId}', 'Centro Tecnológico de Capacitación', 'TRAINING_CENTER', true, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."OccupationEntry" ("id", "catalogVersionId", "code", "name", "description", "active")
      VALUES ('70000000-0000-4000-8000-000000000050', '${catalogVersionId}', 'OCC-BOD-LIVE', 'Coordinador de Almacén', 'Logística de piso', true)
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Opportunity" ("id", "organizationId", "occupationId", "catalogVersionId", "title", "description", "workplaceType", "location", "active", "isDemo", "version", "updatedAt")
      VALUES ('${oppId}', '${employerOrgId}', '70000000-0000-4000-8000-000000000050', '${catalogVersionId}', 'Coordinador de Bodega', 'Supervisión de inventarios y despacho', 'ON_SITE', 'Panamá Pacífico', true, true, 1, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."OpportunityRequirement" ("id", "opportunityId", "competencyId", "catalogVersionId", "requirementType", "stage", "description")
      VALUES ('91000000-0000-4000-8000-000000000050', '${oppId}', '${competency1Id}', '${catalogVersionId}', 'ESSENTIAL', 'ENTRY', 'Manejo avanzado de inventarios')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Course" ("id", "organizationId", "code", "title", "description", "active", "isDemo", "updatedAt")
      VALUES ('${course1Id}', '${trainingCenterOrgId}', 'CUR-INV-LIVE', 'Especialización en Almacén y Existencias', 'Programa técnico intensivo', true, true, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseVersion" ("id", "courseId", "catalogVersionId", "versionNumber", "syllabusText", "durationHours")
      VALUES ('${version1Id}', '${course1Id}', '${catalogVersionId}', 1, 'Módulo único: Inventarios y despacho', 32)
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseLearningOutcome" ("id", "courseVersionId", "competencyId", "catalogVersionId", "description")
      VALUES ('92000000-0000-4000-8000-000000000050', '${version1Id}', '${competency1Id}', '${catalogVersionId}', 'Adquisición de SKILL-INV-LIVE')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CoursePrerequisite" ("id", "courseVersionId", "competencyId", "catalogVersionId", "essential", "description")
      VALUES ('93000000-0000-4000-8000-000000000050', '${version1Id}', '${competency2Id}', '${catalogVersionId}', true, 'Prerrequisito: Aritmética básica')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseEdition" ("id", "courseVersionId", "modality", "location", "startDate", "endDate", "totalSlots", "availableSlots", "costAmount", "costCurrency", "costPeriod", "scheduleSummary", "active", "isDemo", "version", "updatedAt")
      VALUES ('${edition1Id}', '${version1Id}', 'ON_SITE', 'Sede Pacífico', CURRENT_DATE + 7, CURRENT_DATE + 28, 15, 15, 45.00, 'USD', 'TOTAL', 'Sábados 08:00 - 12:00', true, true, 1, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseSession" ("id", "editionId", "weekday", "startMinute", "endMinute", "timezone", "location")
      VALUES ('94000000-0000-4000-8000-000000000050', '${edition1Id}', 6, 480, 720, 'America/Panama', 'Aula Magna 3')
      ON CONFLICT DO NOTHING;
    `);

    // 3. Setup confirmed profile for User A
    const userARow = await dbFixture.admin.query(
      `SELECT "id" FROM app."AppUser" WHERE "authSubject" = '${authFixture.users.a.id}'`
    );
    actorUserId = userARow.rows[0].id;

    const profileARow = await dbFixture.admin.query(
      `SELECT "id" FROM app."CandidateProfile" WHERE "ownerUserId" = '${actorUserId}'`
    );
    const profileAId = profileARow.rows[0].id;
    const revId = "f1000000-0000-4000-8000-000000000050";

    await dbFixture.admin.query(`
      ALTER TABLE app."ProfileRevision" DISABLE TRIGGER ALL;
      ALTER TABLE app."CandidateProfile" DISABLE TRIGGER ALL;

      INSERT INTO app."ProfileRevision" (
        "id", "profileId", "status", "revision", "displayName", "headline", "updatedAt"
      ) VALUES (
        '${revId}', '${profileAId}', 'DRAFT', 1, 'Candidato Live A05', 'Aspirante a Almacén', NOW()
      ) ON CONFLICT DO NOTHING;

      WITH new_src AS (
        INSERT INTO app."ProfileSource" (
          "id", "profileId", "kind", "status", "sha256", "mediaType", "sizeBytes", "manualText"
        ) VALUES (
          gen_random_uuid(), '${profileAId}', 'MANUAL_TEXT', 'READY', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'text/plain', 40, 'Certificado de Aritmética'
        ) RETURNING id
      ),
      new_frag AS (
        INSERT INTO app."SourceFragment" (
          "id", "profileId", "sourceId", "text"
        ) SELECT gen_random_uuid(), '${profileAId}', id, 'Certificado de Aritmética' FROM new_src
        RETURNING id
      ),
      new_ev AS (
        INSERT INTO app."ProfileEvidence" (
          "id", "profileId", "fragmentId", "kind", "scope"
        ) SELECT gen_random_uuid(), '${profileAId}', id, 'DOCUMENT', 'Constancia escolar de matemáticas' FROM new_frag
        RETURNING id
      ),
      new_claim AS (
        INSERT INTO app."CompetencyClaim" (
          "id", "profileId", "revisionId", "competencyId", "catalogVersionId",
          "originalText", "criterion", "decision"
        ) VALUES (
          gen_random_uuid(), '${profileAId}', '${revId}', '${competency2Id}', '${catalogVersionId}',
          'Matemáticas aprobadas', 'Aritmética demostrada', 'ACCEPTED'
        ) RETURNING id
      )
      INSERT INTO app."ProfileEvidenceLink" (
        "id", "profileId", "revisionId", "evidenceId", "claimId"
      ) VALUES (
        gen_random_uuid(), '${profileAId}', '${revId}', (SELECT id FROM new_ev), (SELECT id FROM new_claim)
      );

      INSERT INTO app."AvailabilityWindow" (
        "id", "profileId", "revisionId", "weekday", "startMinute", "endMinute", "validFrom", "validTo"
      ) VALUES
        (gen_random_uuid(), '${profileAId}', '${revId}', 6, 420, 1080, CURRENT_DATE, CURRENT_DATE + 90);

      INSERT INTO app."ProfileConstraints" (
        "id", "profileId", "revisionId", "trainingBudget", "trainingCurrency", "trainingPeriod", "trainingState", "availabilityState"
      ) VALUES
        (gen_random_uuid(), '${profileAId}', '${revId}', 100.00, 'USD', 'TOTAL', 'KNOWN', 'KNOWN');

      UPDATE app."ProfileRevision" SET
        "status" = 'CONFIRMED',
        "versionNumber" = 1,
        "confirmedAt" = NOW(),
        "confirmedById" = '${actorUserId}',
        "snapshotDigest" = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      WHERE "id" = '${revId}';

      UPDATE app."CandidateProfile"
      SET "currentVersionId" = '${revId}'
      WHERE "id" = '${profileAId}';

      ALTER TABLE app."ProfileRevision" ENABLE TRIGGER ALL;
      ALTER TABLE app."CandidateProfile" ENABLE TRIGGER ALL;
    `);

    // 4. Calculate and persist real plan for User A
    const resPlan = await client.request("/api/v1/me/learning-plans/preview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "live-a05-plan-key-001",
      },
      body: JSON.stringify({
        target_opportunity_id: oppId,
        assumptions: { max_budget: 100, commute_minutes: 0 },
      }),
    });

    const planBody = (await resPlan.json()) as any;
    expect(resPlan.status).toBe(201);
    expect(planBody.data.feasibility).toBe("VIABLE");
    expect(planBody.data.steps.length).toBe(1);
    planId = planBody.data.id;
  });

  afterAll(async () => {
    if (authFixture) authFixture.stop();
    if (dbFixture) await dbFixture.close();
  });

  it.skipIf(process.env.RUN_VERTEX_A05_EVAL !== "1")(
    "Agent A05 executes autonomous loop in Vertex AI using Gemini 3.8 Flash with ADC and real tools",
    async () => {
      const startTime = Date.now();
      const result = await a05Service.explainPlan({
        planId,
        actorUserId,
        consent: true,
        answers: [
          { field: "budget_clarification", text: "Cuento con presupuesto disponible para la matrícula de $45." },
        ],
      });
      const durationMs = Date.now() - startTime;

      expect(result.provider).toBe("vertex-gemini-3.8-flash");
      expect(result.explanation).toBeDefined();
      expect(result.explanation.agent_id).toBe("A05");
      expect(result.explanation.contract_version).toBe("agent-result/1");
      expect(result.explanation.status).toBe("completed");
      expect(result.explanation.decision.feasibility).toBe("VIABLE");
      expect(result.explanation.summary.length).toBeGreaterThan(40);

      // Validate schema compliance
      const parsed = LearningPlanExplanationViewSchema.safeParse(result.explanation);
      expect(parsed.success).toBe(true);

      // Check tool trace
      expect(Array.isArray(result.toolsInvoked)).toBe(true);
      expect(result.toolsInvoked).toContain("leer_resultado");
      expect(result.toolsInvoked).toContain("entregar_explicacion");

      console.log("[LIVE TEST RESULT] A05 Vertex AI Execution Summary:", JSON.stringify({
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
    130000
  );
});
