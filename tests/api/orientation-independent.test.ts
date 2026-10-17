import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { OpportunitiesService } from "../../apps/api/src/modules/opportunities/opportunities.service";
import { CoursesService } from "../../apps/api/src/modules/courses/courses.service";
import { createPlanningModule } from "../../apps/api/src/modules/planning/planning.module";
import { createReservationsModule } from "../../apps/api/src/modules/reservations/reservations.module";
import { OrientationService } from "../../apps/api/src/modules/orientation/orientation.service";

describe("D8 Independent Orientation & Accompaniment Tests", () => {
  let dbFixture: DatabaseFixture;
  let authFixture: AuthFixture;
  let client: ReturnType<typeof createApp>;

  // Tokens
  let youthToken: string;
  let counselorToken: string;
  let foreignCounselorToken: string;
  let recruiterToken: string;

  // IDs
  let youthUserId: string;
  let youthProfileId: string;
  let confirmedRevisionId: string;
  let planId: string;
  let secondPlanId: string;

  let counselorUserId: string;
  let counselorId: string;
  let foreignCounselorUserId: string;
  let foreignCounselorId: string;

  let targetOpportunityId: string;
  let courseEditionId: string;

  let engagementId: string;
  let clarificationId: string;

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
    const opportunitiesService = new OpportunitiesService(dbFixture.db);
    const coursesService = new CoursesService(dbFixture.db);
    const planningModule = createPlanningModule(dbFixture.db);
    const reservationsModule = createReservationsModule(dbFixture.db);
    const orientationService = new OrientationService(dbFixture.db);

    client = createApp({
      identityService,
      profileService,
      opportunitiesService,
      coursesService,
      planningService: planningModule.service,
      reservationsService: reservationsModule.service,
      orientationService,
      verifyToken: async (token) => {
        if (token === authFixture.tokens.a) return { id: "00000000-0000-0000-0000-000000000001", email: "youth@test.local", role: "authenticated" };
        if (token === authFixture.tokens.b) return { id: "00000000-0000-0000-0000-000000000002", email: "counselor@test.local", role: "authenticated" };
        if (token === "foreign-counselor-token") return { id: "00000000-0000-0000-0000-000000000003", email: "foreign@test.local", role: "authenticated" };
        if (token === "recruiter-token") return { id: "00000000-0000-0000-0000-000000000004", email: "recruiter@test.local", role: "authenticated" };
        throw new Error("Invalid token");
      },
      allowedOrigins: config.allowedOrigins,
    });

    youthToken = authFixture.tokens.a;
    counselorToken = authFixture.tokens.b;
    foreignCounselorToken = "foreign-counselor-token";
    recruiterToken = "recruiter-token";

    // 1. Inicializar usuarios en DB
    const resYouth = await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${youthToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const youthData: any = await resYouth.json();
    youthUserId = youthData.data.user.id;

    const resCounselor = await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${counselorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const counselorData: any = await resCounselor.json();
    counselorUserId = counselorData.data.user.id;

    const resForeign = await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${foreignCounselorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const foreignData: any = await resForeign.json();
    foreignCounselorUserId = foreignData.data.user.id;

    // 2. Registrar a los orientadores en app.OrientationCounselor
    counselorId = crypto.randomUUID();
    foreignCounselorId = crypto.randomUUID();
    await dbFixture.admin.query(`
      INSERT INTO app."OrientationCounselor" (id, "userId", "displayName", specialty, active, "updatedAt")
      VALUES 
        ('${counselorId}', '${counselorUserId}', 'Lic. Marcos Valdés', 'Orientación Vocacional y Logística', true, now()),
        ('${foreignCounselorId}', '${foreignCounselorUserId}', 'Dra. Elena Gómez', 'Desarrollo de Habilidades Blandas', true, now());
    `);

    // 3. Crear perfil confirmado del joven y datos de catálogo
    const resProfile = await client.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${youthToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const profileJson: any = await resProfile.json();
    youthProfileId = profileJson.data.id;

    confirmedRevisionId = crypto.randomUUID();
    const catalogVersionId = "c0000000-0000-4000-8000-000000000001";
    const occupationId = "0a000000-0000-4000-8000-000000000001";
    const comp1 = "11111111-0000-4000-8000-000000000001";
    const comp2 = "22222222-0000-4000-8000-000000000002";
    const companyId = crypto.randomUUID();
    targetOpportunityId = crypto.randomUUID();
    const courseId = crypto.randomUUID();
    const courseVersionId = crypto.randomUUID();
    courseEditionId = crypto.randomUUID();
    const dummyDigest = "a".repeat(64);

    await dbFixture.admin.query(`
      INSERT INTO app."CatalogVersion" (id, code, "sourceLabel")
      VALUES ('${catalogVersionId}', 'CAT-D8', 'Catálogo Nacional D8')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."OccupationEntry" (id, "catalogVersionId", code, name, description)
      VALUES ('${occupationId}', '${catalogVersionId}', '8332', 'Auxiliar de Logística y Almacén', 'Operaciones de almacén')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CompetencyEntry" (id, "catalogVersionId", code, name, kind, description)
      VALUES 
        ('${comp1}', '${catalogVersionId}', 'COMP-01', 'Gestión de Inventarios', 'SKILL', 'Manejo de stock'),
        ('${comp2}', '${catalogVersionId}', 'COMP-02', 'Seguridad en Bodega', 'KNOWLEDGE', 'Normas de seguridad')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Organization" (id, name, type, active, "updatedAt")
      VALUES ('${companyId}', 'Distribuidora del Pacífico', 'COMPANY', true, now())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Opportunity" (id, "organizationId", "occupationId", "catalogVersionId", title, description, location, "workplaceType", "availableSlots", version, "createdAt", "updatedAt")
      VALUES ('${targetOpportunityId}', '${companyId}', '${occupationId}', '${catalogVersionId}', 'Auxiliar de Bodega', 'Tareas de empaque', 'Panamá', 'ON_SITE', 3, 1, now(), now());

      INSERT INTO app."OpportunityRequirement" (id, "opportunityId", "competencyId", "catalogVersionId", "requirementType", stage, description)
      VALUES 
        ('${crypto.randomUUID()}', '${targetOpportunityId}', '${comp1}', '${catalogVersionId}', 'ESSENTIAL', 'ENTRY', 'Manejo de inventario requerido'),
        ('${crypto.randomUUID()}', '${targetOpportunityId}', '${comp2}', '${catalogVersionId}', 'ESSENTIAL', 'TRAINABLE', 'Normas de bodega');

      -- Curso y Edición
      INSERT INTO app."Course" (id, "organizationId", code, title, description, active, "isDemo", "createdAt", "updatedAt")
      VALUES ('${courseId}', '${companyId}', 'CUR-BOD-01', 'Curso de Operaciones de Bodega', 'Formación operativa', true, true, now(), now());

      INSERT INTO app."CourseVersion" (id, "courseId", "catalogVersionId", "versionNumber", "syllabusText", "durationHours", "confirmedAt")
      VALUES ('${courseVersionId}', '${courseId}', '${catalogVersionId}', 1, 'Contenido operativo', 20, now());

      INSERT INTO app."CourseEdition" (id, "courseVersionId", modality, "startDate", "endDate", "totalSlots", "costAmount", "costCurrency", "costPeriod", "scheduleSummary", active, "isDemo", "publishedAt", "createdAt", "updatedAt")
      VALUES ('${courseEditionId}', '${courseVersionId}', 'ON_SITE', now() + interval '5 days', now() + interval '25 days', 10, 0.00, 'USD', 'TOTAL', 'Lunes a Viernes 8:00 - 12:00', true, true, now(), now(), now());

      INSERT INTO app."CourseSession" (id, "editionId", weekday, "startMinute", "endMinute", timezone)
      VALUES ('${crypto.randomUUID()}', '${courseEditionId}', 1, 480, 720, 'America/Panama');

      -- Perfil del candidato: insertar como DRAFT primero para respetar guard_revision_child()
      ALTER TABLE app."ProfileRevision" DISABLE TRIGGER ALL;
      ALTER TABLE app."CandidateProfile" DISABLE TRIGGER ALL;

      INSERT INTO app."ProfileRevision" (
        id, "profileId", status, revision, "displayName", "headline", "updatedAt"
      ) VALUES (
        '${confirmedRevisionId}', '${youthProfileId}', 'DRAFT', 1, 'Joven Demo', 'Aspirante Logística', now()
      );

      INSERT INTO app."CompetencyClaim" (id, "profileId", "revisionId", "competencyId", "catalogVersionId", "originalText", criterion, decision)
      VALUES ('${crypto.randomUUID()}', '${youthProfileId}', '${confirmedRevisionId}', '${comp1}', '${catalogVersionId}', 'Experiencia previa de stock', 'Acreditado', 'ACCEPTED');

      INSERT INTO app."ProfileConstraints" (
        id, "profileId", "revisionId",
        "locationState", "approximateZone",
        "travelLimitState", "maxOneWayMinutes",
        "trainingState", "trainingBudget", "trainingCurrency", "trainingPeriod",
        "transportState", "transportBudget", "transportCurrency", "transportPeriod"
      ) VALUES (
        '${crypto.randomUUID()}', '${youthProfileId}', '${confirmedRevisionId}',
        'KNOWN', 'Ciudad de Panamá',
        'KNOWN', 45,
        'KNOWN', 100.00, 'USD', 'TOTAL',
        'KNOWN', 50.00, 'USD', 'MONTH'
      );

      UPDATE app."ProfileRevision" SET
        status = 'CONFIRMED',
        "versionNumber" = 1,
        "confirmedAt" = now(),
        "confirmedById" = '${youthUserId}',
        "snapshotDigest" = '${dummyDigest}'
      WHERE id = '${confirmedRevisionId}';

      UPDATE app."CandidateProfile"
      SET "currentVersionId" = '${confirmedRevisionId}'
      WHERE id = '${youthProfileId}';

      ALTER TABLE app."ProfileRevision" ENABLE TRIGGER ALL;
      ALTER TABLE app."CandidateProfile" ENABLE TRIGGER ALL;
    `);

    // 4. Crear planes de aprendizaje para el joven
    planId = crypto.randomUUID();
    secondPlanId = crypto.randomUUID();
    await dbFixture.admin.query(`
      INSERT INTO app."LearningPlan" (id, "profileId", "revisionId", "targetOpportunityId", "targetOccupationId", status, feasibility, "coverageNumerator", "coverageDenominator", "totalCostAmount", currency, "residualGap", reasons, "assumptionsJson", version, "createdAt", "updatedAt")
      VALUES 
        ('${planId}', '${youthProfileId}', '${confirmedRevisionId}', '${targetOpportunityId}', '${occupationId}', 'CONFIRMED', 'VIABLE', 2, 2, 0.00, 'USD', ARRAY[]::text[], ARRAY['Ruta óptima']::text[], '{}', 1, now(), now()),
        ('${secondPlanId}', '${youthProfileId}', '${confirmedRevisionId}', '${targetOpportunityId}', '${occupationId}', 'CONFIRMED', 'INVIABLE', 1, 2, 0.00, 'USD', ARRAY['Sin cupos']::text[], ARRAY['Colisión de horario']::text[], '{}', 1, now(), now());

      INSERT INTO app."LearningPlanStep" (id, "planId", "editionId", "stepOrder", "stepType")
      VALUES ('${crypto.randomUUID()}', '${planId}', '${courseEditionId}', 1, 'DIRECT');
    `);
  }, 35000);

  afterAll(async () => {
    await dbFixture.close();
    authFixture.stop();
  });

  it("1. Joven lista orientadores habilitados activos", async () => {
    const res = await client.request("/api/v1/counselors", {
      headers: { Authorization: `Bearer ${youthToken}` },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    const names = body.data.map((c: any) => c.display_name);
    expect(names).toContain("Lic. Marcos Valdés");
    expect(names).toContain("Dra. Elena Gómez");
  });

  it("2. Joven solicita acompañamiento con versión concreta de ruta; idempotencia no duplica", async () => {
    const key = "idem-ori-req-00000000001";
    const res = await client.request(`/api/v1/me/learning-plans/${planId}/engagements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${youthToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        counselor_id: counselorId,
        purpose: "Deseo orientación sobre la viabilidad del curso y los horarios de la vacante",
      }),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe("REQUESTED");
    expect(body.data.receipt_number).toMatch(/^REC-ORI-/);
    expect(body.data.plan_version).toBe(1);
    expect(body.data.counselor.id).toBe(counselorId);

    engagementId = body.data.id;

    // Replay idempotente con la misma clave
    const resReplay = await client.request(`/api/v1/me/learning-plans/${planId}/engagements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${youthToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        counselor_id: counselorId,
        purpose: "Deseo orientación sobre la viabilidad del curso y los horarios de la vacante",
      }),
    });

    expect(resReplay.status).toBe(200);
    const bodyReplay: any = await resReplay.json();
    expect(bodyReplay.data.id).toBe(engagementId);
    expect(bodyReplay.data.receipt_number).toBe(body.data.receipt_number);
  });

  it("3. Orientador asignado ve la solicitud en su bandeja de entrada", async () => {
    const res = await client.request("/api/v1/counselor/engagements", {
      headers: { Authorization: `Bearer ${counselorToken}` },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    const item = body.data.find((e: any) => e.id === engagementId);
    expect(item).toBeDefined();
    expect(item.plan_version).toBe(1);
    expect(item.status).toBe("REQUESTED");
  });

  it("4. Orientador ajeno NO ve la solicitud asignada al otro orientador", async () => {
    const res = await client.request("/api/v1/counselor/engagements", {
      headers: { Authorization: `Bearer ${foreignCounselorToken}` },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    const item = body.data.find((e: any) => e.id === engagementId);
    expect(item).toBeUndefined();

    // Intento de acceso directo por ID da 404
    const resDirect = await client.request(`/api/v1/counselor/engagements/${engagementId}`, {
      headers: { Authorization: `Bearer ${foreignCounselorToken}` },
    });
    expect(resDirect.status).toBe(404);
  });

  it("5. Orientador consulta detalle autorizado: ruta, factibilidad C01 y datos minimizados", async () => {
    const res = await client.request(`/api/v1/counselor/engagements/${engagementId}`, {
      headers: { Authorization: `Bearer ${counselorToken}` },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.plan.id).toBe(planId);
    expect(body.data.plan.steps.length).toBe(1);
    expect(body.data.plan.steps[0].course_title).toBe("Curso de Operaciones de Bodega");
    expect(body.data.candidate_summary.display_name).toContain("Candidato #");
    expect(body.data.candidate_summary.max_commute_minutes).toBe(45);
    expect(body.data.target_opportunity.title).toBe("Auxiliar de Bodega");
  });

  it("6. Orientador propone aclaración; joven la recibe y responde (aceptar/rechazar)", async () => {
    // 1. Orientador crea aclaración
    const resClar = await client.request(`/api/v1/counselor/engagements/${engagementId}/clarifications`, {
      method: "POST",
      headers: { Authorization: `Bearer ${counselorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "¿Tienes disponibilidad de transporte para llegar a las 8:00 AM al centro de capacitación?",
        proposed_correction: "Verificar tiempo de traslado en autobús para no llegar con retraso.",
      }),
    });
    expect(resClar.status).toBe(201);
    const clarJson: any = await resClar.json();
    clarificationId = clarJson.data.id;
    expect(clarJson.data.youth_decision).toBe("PENDING");

    // 2. Joven responde rechazando la sugerencia sin alterar su perfil
    const resResp = await client.request(`/api/v1/me/orientations/${engagementId}/clarifications/${clarificationId}/respond`, {
      method: "POST",
      headers: { Authorization: `Bearer ${youthToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "REJECTED",
        response: "El metro me deja a 5 minutos a pie de la sede, llego sin problema.",
      }),
    });
    expect(resResp.status).toBe(200);
    const respJson: any = await resResp.json();
    expect(respJson.data.youth_decision).toBe("REJECTED");
    expect(respJson.data.youth_response).toContain("metro");
  });

  it("7. Plan INVIABLE no puede ser aprobado por orientador (regla determinista C01)", async () => {
    // Joven solicita orientación sobre plan inviable
    const resReq = await client.request(`/api/v1/me/learning-plans/${secondPlanId}/engagements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${youthToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-ori-inviable-001",
      },
      body: JSON.stringify({
        counselor_id: counselorId,
        purpose: "Revisar ruta con conflicto",
      }),
    });
    expect(resReq.status).toBe(201);
    const engInviable: any = await resReq.json();

    // Orientador intenta forzar aprobación sobre el plan INVIABLE
    const resApprove = await client.request(`/api/v1/counselor/engagements/${engInviable.data.id}/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${counselorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_plan_version: 1,
        decision: "APPROVED",
        motivation: "Aprobación forzada",
      }),
    });
    expect(resApprove.status).toBe(409);
    const errJson: any = await resApprove.json();
    expect(errJson.error.code).toBe("CANNOT_APPROVE_INVIABLE_PLAN");
  });

  it("8. Intento de aprobar con versión obsoleta de plan falla con 409 OUTDATED_PLAN_VERSION", async () => {
    const resOutdated = await client.request(`/api/v1/counselor/engagements/${engagementId}/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${counselorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_plan_version: 999, // versión inexistente
        decision: "APPROVED",
        motivation: "Revisión sobre versión incorrecta",
      }),
    });
    expect(resOutdated.status).toBe(409);
    const errJson: any = await resOutdated.json();
    expect(errJson.error.code).toBe("OUTDATED_PLAN_VERSION");
  });

  it("9. Ruta acompañada NO aprobada bloquea la reserva; aprobación válida permite reservar", async () => {
    // 1. Intento de reservar cuando el plan aún no tiene revisión APPROVED
    const resResBefore = await client.request("/api/v1/me/course-reservations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${youthToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-res-block-0000001",
      },
      body: JSON.stringify({
        edition_id: courseEditionId,
        plan_id: planId,
      }),
    });
    expect(resResBefore.status).toBe(409);
    const errResBefore: any = await resResBefore.json();
    expect(errResBefore.error.code).toBe("PLAN_REVIEW_NOT_APPROVED");

    // 2. Orientador emite revisión motivada APPROVED sobre la versión 1 válida
    const resReview = await client.request(`/api/v1/counselor/engagements/${engagementId}/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${counselorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_plan_version: 1,
        decision: "APPROVED",
        motivation: "Plan revisado favorablemente. Cumple con la cercanía logística y la complementariedad de competencias.",
        reasons: ["Cumplimiento de prerrequisitos", "Compatibilidad con la vacante objetivo"],
      }),
    });
    expect(resReview.status).toBe(200);
    const reviewJson: any = await resReview.json();
    expect(reviewJson.data.decision).toBe("APPROVED");

    // 3. Ahora el joven reserva exitosamente la edición de su ruta acompañada aprobada
    const resResAfter = await client.request("/api/v1/me/course-reservations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${youthToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-res-pass-0000001",
      },
      body: JSON.stringify({
        edition_id: courseEditionId,
        plan_id: planId,
      }),
    });
    expect(resResAfter.status).toBe(201);
    const resSuccessJson: any = await resResAfter.json();
    expect(resSuccessJson.data.status).toBe("CONFIRMED");
    expect(resSuccessJson.data.reservation_number).toMatch(/^RES-/);
  });

  it("10. Joven revoca acompañamiento; orientador pierde inmediatamente acceso por RLS y revocación no cancela reserva previa", async () => {
    // 1. Joven revoca el acompañamiento
    const resRevoke = await client.request(`/api/v1/me/orientations/${engagementId}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${youthToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Ya finalicé mis dudas con el orientador" }),
    });
    expect(resRevoke.status).toBe(200);
    const revokeJson: any = await resRevoke.json();
    expect(revokeJson.data.status).toBe("REVOKED");

    // 2. Orientador intenta consultar el detalle: RLS y servicio devuelven 404 (corte inmediato)
    const resCounselorRead = await client.request(`/api/v1/counselor/engagements/${engagementId}`, {
      headers: { Authorization: `Bearer ${counselorToken}` },
    });
    expect(resCounselorRead.status).toBe(404);

    // 3. Orientador intenta emitir aclaración o revisión sobre caso revocado: 404/403
    const resReviewAfterRevoke = await client.request(`/api/v1/counselor/engagements/${engagementId}/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${counselorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_plan_version: 1,
        decision: "APPROVED",
        motivation: "Intento tras revocación",
      }),
    });
    expect(resReviewAfterRevoke.status).toBe(404);

    // 4. La reserva previamente confirmada por el joven permanece intacta en app.CourseReservation
    const resMyReservations = await client.request("/api/v1/me/course-reservations", {
      headers: { Authorization: `Bearer ${youthToken}` },
    });
    expect(resMyReservations.status).toBe(200);
    const myResJson: any = await resMyReservations.json();
    expect(myResJson.data.items.length).toBeGreaterThanOrEqual(1);
    const myRes = myResJson.data.items.find((r: any) => r.edition_id === courseEditionId);
    expect(myRes).toBeDefined();
    expect(myRes.status).toBe("CONFIRMED");
  });

  // Pruebas de frontera D8 (V01 - V05)
  async function auditCase(feasibility = 'VIABLE') {
    await dbFixture.admin.query('UPDATE app."OrientationEngagement" SET status=\'REVOKED\' WHERE "candidateProfileId"=$1', [youthProfileId]);
    await dbFixture.admin.query('UPDATE app."CourseReservation" SET status=\'CANCELLED\' WHERE "profileId"=$1', [youthProfileId]);
    const id = crypto.randomUUID();
    await dbFixture.admin.query(`INSERT INTO app."LearningPlan" (id,"profileId","revisionId","targetOpportunityId",status,feasibility,"coverageNumerator","coverageDenominator","residualGap",reasons,"assumptionsJson",version,"updatedAt")
      SELECT $1,"profileId","revisionId","targetOpportunityId",'CONFIRMED',$2::app."PlanFeasibility",1,1,ARRAY[]::text[],ARRAY['Fixture de auditoría']::text[],'{}',1,now() FROM app."LearningPlan" WHERE id=$3`, [id, feasibility, planId]);
    await dbFixture.admin.query('INSERT INTO app."LearningPlanStep" (id,"planId","editionId","stepOrder","stepType") VALUES ($1,$2,$3,1,\'DIRECT\')', [crypto.randomUUID(),id,courseEditionId]);
    const res=await client.request(`/api/v1/me/learning-plans/${id}/engagements`,{method:'POST',headers:{Authorization:`Bearer ${youthToken}`,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({counselor_id:counselorId,purpose:'Auditoría sintética de límites'})});
    expect(res.status).toBe(201);
    return {plan:id,engagement:(await res.json() as any).data.id};
  }

  const auditReview = (id:string,key=crypto.randomUUID())=>client.request(`/api/v1/counselor/engagements/${id}/review`,{method:'POST',headers:{Authorization:`Bearer ${counselorToken}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({expected_plan_version:1,decision:'APPROVED',motivation:'Revisión sintética para auditar límites'})});

  it('11. AUDIT V01: Orientador no puede aprobar viabilidad con logística PENDING', async () => {
    const item = await auditCase('PENDING');
    const response = await auditReview(item.engagement);
    expect(response.status).toBe(409);
    const err = await response.json() as any;
    expect(err.error.code).toBe('CANNOT_APPROVE_PENDING_PLAN');
  });

  it('12. AUDIT V02: Plan marcado como outdated rechaza aprobación', async () => {
    const item = await auditCase();
    await dbFixture.admin.query('UPDATE app."LearningPlan" SET outdated=true WHERE id=$1', [item.plan]);
    const response = await auditReview(item.engagement);
    expect(response.status).toBe(409);
    const err = await response.json() as any;
    expect(err.error.code).toBe('OUTDATED_PLAN_VERSION');
  });

  it('13. AUDIT V02: Modificación de versión de vacante invalida revisión dependiente', async () => {
    const item = await auditCase();
    await dbFixture.admin.query('UPDATE app."Opportunity" SET version=version+1 WHERE id=$1', [targetOpportunityId]);
    try {
      const response = await auditReview(item.engagement);
      expect(response.status).toBe(409);
      const err = await response.json() as any;
      expect(err.error.code).toBe('OUTDATED_PLAN_VERSION');
    } finally {
      await dbFixture.admin.query('UPDATE app."Opportunity" SET version=version-1 WHERE id=$1', [targetOpportunityId]);
    }
  });

  it('14. AUDIT V03: Reintento de revisión con misma clave no duplica registros ni efectos', async () => {
    const item = await auditCase();
    const key = crypto.randomUUID();
    expect((await auditReview(item.engagement, key)).status).toBe(200);
    expect((await auditReview(item.engagement, key)).status).toBe(200);
    const count = (await dbFixture.admin.query('SELECT count(*)::int AS n FROM app."OrientationReview" WHERE "engagementId"=$1', [item.engagement])).rows[0].n;
    expect(count).toBe(1);

    // Misma clave con contenido diferente produce conflicto 409
    const conflictRes = await client.request(`/api/v1/counselor/engagements/${item.engagement}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${counselorToken}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ expected_plan_version: 1, decision: 'REJECTED', motivation: 'Contenido modificado con misma clave' }),
    });
    expect(conflictRes.status).toBe(409);
    const conflictErr = await conflictRes.json() as any;
    expect(conflictErr.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('15. AUDIT V04: Revisión motivada emite evidencia atómica en AuditEvent', async () => {
    const item = await auditCase();
    const before = (await dbFixture.admin.query('SELECT count(*)::int AS n FROM app."AuditEvent"')).rows[0].n;
    expect((await auditReview(item.engagement)).status).toBe(200);
    const after = (await dbFixture.admin.query('SELECT count(*)::int AS n FROM app."AuditEvent"')).rows[0].n;
    expect(after - before).toBeGreaterThan(0);
  });

  it('16. AUDIT V05: Reserva procedente de ruta revocada exige revalidación, pero reserva independiente de la misma edición tras revocar queda habilitada', async () => {
    // 1. Preparar caso con acompañamiento y revisión aprobada
    const item = await auditCase();
    expect((await auditReview(item.engagement)).status).toBe(200);

    // 2. Joven revoca acompañamiento
    const revoked = await client.request(`/api/v1/me/orientations/${item.engagement}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${youthToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Retirar acompañamiento y continuar por mi cuenta' }),
    });
    expect(revoked.status).toBe(200);

    // 3. Acción procedente de la ruta acompañada revocada (enviando plan_id) es bloqueada con 409 ORIENTATION_REVOKED
    const responseWithRevokedPlan = await client.request('/api/v1/me/course-reservations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${youthToken}`, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ edition_id: courseEditionId, plan_id: item.plan }),
    });
    expect(responseWithRevokedPlan.status).toBe(409);
    const err = await responseWithRevokedPlan.json() as any;
    expect(err.error.code).toBe('ORIENTATION_REVOKED');

    // 4. Joven decide realizar una NUEVA reserva independiente de la MISMA edición por cuenta propia (sin plan_id):
    // El contrato de reserva independiente permite la acción directa del joven con confirmación 201
    const responseIndependent = await client.request('/api/v1/me/course-reservations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${youthToken}`, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ edition_id: courseEditionId }),
    });
    expect(responseIndependent.status).toBe(201);
    const indData = (await responseIndependent.json() as any).data;
    expect(indData.status).toBe('CONFIRMED');
    expect(indData.edition_id).toBe(courseEditionId);
  });

  it('17. D8/D4 Integración: Reserva independiente de catálogo no se bloquea por ruta revocada de otra edición', async () => {
    // Crear una segunda edición formativa totalmente independiente de la ruta
    const otherCourseId = crypto.randomUUID();
    const otherCourseVersionId = crypto.randomUUID();
    const otherEditionId = crypto.randomUUID();
    await dbFixture.admin.query(`
      INSERT INTO app."Course" (id, "organizationId", code, title, description, active, "isDemo", "createdAt", "updatedAt")
      SELECT '${otherCourseId}', "organizationId", 'CUR-IND-01', 'Curso de Logística Externa', 'Formación libre', true, true, now(), now()
      FROM app."Course" WHERE id = (SELECT "courseId" FROM app."CourseVersion" WHERE id = (SELECT "courseVersionId" FROM app."CourseEdition" WHERE id = '${courseEditionId}'));

      INSERT INTO app."CourseVersion" (id, "courseId", "catalogVersionId", "versionNumber", "syllabusText", "durationHours", "confirmedAt")
      SELECT '${otherCourseVersionId}', '${otherCourseId}', "catalogVersionId", 1, 'Temario libre', 15, now()
      FROM app."CourseVersion" WHERE id = (SELECT "courseVersionId" FROM app."CourseEdition" WHERE id = '${courseEditionId}');

      INSERT INTO app."CourseEdition" (id, "courseVersionId", modality, "startDate", "endDate", "totalSlots", "costAmount", "costCurrency", "costPeriod", "scheduleSummary", active, "isDemo", "publishedAt", "createdAt", "updatedAt")
      VALUES ('${otherEditionId}', '${otherCourseVersionId}', 'ON_SITE', now() + interval '10 days', now() + interval '30 days', 5, 0.00, 'USD', 'TOTAL', 'Sábados 9:00 - 13:00', true, true, now(), now(), now());

      INSERT INTO app."CourseSession" (id, "editionId", weekday, "startMinute", "endMinute", timezone)
      VALUES ('${crypto.randomUUID()}', '${otherEditionId}', 6, 540, 780, 'America/Panama');
    `);

    // Joven reserva la otra edición independiente directamente: debe responder 201 exitoso
    const resIndependent = await client.request('/api/v1/me/course-reservations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${youthToken}`, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ edition_id: otherEditionId }),
    });
    expect(resIndependent.status).toBe(201);
    const indData = (await resIndependent.json() as any).data;
    expect(indData.status).toBe('CONFIRMED');
    expect(indData.edition_id).toBe(otherEditionId);
  });
});
