import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/training-center-database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { OpportunitiesService } from "../../apps/api/src/modules/opportunities/opportunities.service";
import { AgentA01Service } from "../../apps/api/src/modules/recruitment/agent-a01.service";
import { RecruitmentService } from "../../apps/api/src/modules/recruitment/recruitment.service";
import { ApplicationsService } from "../../apps/api/src/modules/recruitment/applications.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";

describe("D5/D6 Recruitment, Vacancies and Applications Integration Tests", () => {
  let dbFixture: DatabaseFixture;
  let authFixture: AuthFixture;
  let client: ReturnType<typeof createApp>;

  // Token holders
  let recruiterToken: string;
  let foreignRecruiterToken: string;
  let candidateToken: string;

  // IDs
  const catalogVersionId = "c0000000-0000-4000-8000-000000000001";
  const occupationId = "0a000000-0000-4000-8000-000000000001";
  const competency1Id = "11111111-0000-4000-8000-000000000001";
  const competency2Id = "22222222-0000-4000-8000-000000000002";

  const companyAId = "90000000-0000-4000-8000-000000000001";
  const companyBId = "90000000-0000-4000-8000-000000000002"; // Foreign company

  let recruiterUserId: string;
  let foreignRecruiterUserId: string;
  let candidateUserId: string;
  let candidateProfileId: string;
  let confirmedRevisionId: string;

  let activeDraftId: string;
  let publishedOpportunityId: string;
  let candidateApplicationId: string;

  beforeAll(async () => {
    dbFixture = await setupTestDatabase();
    authFixture = startAuthFixture(55442);

    const config = {
      ...dbFixture.config,
      supabaseUrl: authFixture.url,
      allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
    };

    const identityService = new IdentityService(dbFixture.db);
    const profileService = new ProfileService(dbFixture.db);
    const opportunitiesService = new OpportunitiesService(dbFixture.db);

    // Mock A01 runner para pruebas deterministas offline
    const testA01Runner = async (input: { rawText: string; actorUserId: string }) => {
      return {
        title: "Auxiliar de Bodega e Inventario",
        occupation_id: occupationId,
        occupation_name: "Auxiliar de Bodega",
        proposed_requirements: [
          {
            competency_id: competency1Id,
            competency_name: "Control de inventarios y stock",
            requirement_type: "ESSENTIAL" as const,
            stage: "ENTRY" as const,
            description: "Control de entradas y salidas de mercancía",
          },
          {
            competency_id: competency2Id,
            competency_name: "Manejo de transpaleta manual",
            requirement_type: "DESIRABLE" as const,
            stage: "TRAINABLE" as const,
            description: "Operación segura de equipo de carga",
          },
        ],
        clarification_questions: ["¿Se requiere turno rotativo de noche?", "¿El salario ofrecido incluye transporte?"],
        discriminatory_warnings: [],
        has_blocking_issues: false,
        provider: "test-mock-a01",
        toolsInvoked: ["buscar_catalogo_ocupaciones", "buscar_catalogo_competencias", "proponer_vacante"],
      };
    };

    const a01Service = new AgentA01Service(dbFixture.db, testA01Runner);
    const recruitmentService = new RecruitmentService(dbFixture.db, a01Service);
    const applicationsService = new ApplicationsService(dbFixture.db);
    const verifyToken = createVerifyToken(config);

    client = createApp({
      identityService,
      profileService,
      opportunitiesService,
      recruitmentService,
      applicationsService,
      verifyToken,
      allowedOrigins: config.allowedOrigins,
    });

    // Seed Catálogo
    await dbFixture.admin.query(`
      INSERT INTO app."CatalogVersion" (id, code, "sourceLabel")
      VALUES ('${catalogVersionId}', 'V1', 'Catálogo Nacional 2026')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO app."OccupationEntry" (id, "catalogVersionId", code, name, description)
      VALUES ('${occupationId}', '${catalogVersionId}', 'OCC-BOD', 'Auxiliar de Bodega', 'Labores de almacén')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CompetencyEntry" (id, "catalogVersionId", code, name, kind, description)
      VALUES
        ('${competency1Id}', '${catalogVersionId}', 'COMP-INV', 'Control de inventarios y stock', 'SKILL', 'Registro y control'),
        ('${competency2Id}', '${catalogVersionId}', 'COMP-TPAL', 'Manejo de transpaleta manual', 'SKILL', 'Carga y descarga')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Organization" (id, name, type, active, "updatedAt")
      VALUES
        ('${companyAId}', 'Logística Panamá S.A.', 'COMPANY', true, now()),
        ('${companyBId}', 'Transportes del Istmo S.A.', 'COMPANY', true, now())
      ON CONFLICT DO NOTHING;
    `);

    // 1. Setup Recruiter Company A
    recruiterToken = authFixture.tokens.a;
    const resRecruiterBoot = await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${recruiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const recruiterData: any = await resRecruiterBoot.json();
    recruiterUserId = recruiterData.data.user.id;

    // Vincular recruiter a Empresa A
    await dbFixture.admin.query(`
      INSERT INTO app."OrganizationMembership" (id, "userId", "organizationId", role, status, "updatedAt")
      VALUES ('${crypto.randomUUID()}', '${recruiterUserId}', '${companyAId}', 'RECRUITER', 'ACTIVE', now());
    `);

    // 2. Setup Recruiter Company B (Foreign)
    foreignRecruiterToken = authFixture.tokens.b;
    const resForeignBoot = await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${foreignRecruiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const foreignData: any = await resForeignBoot.json();
    foreignRecruiterUserId = foreignData.data.user.id;

    await dbFixture.admin.query(`
      INSERT INTO app."OrganizationMembership" (id, "userId", "organizationId", role, status, "updatedAt")
      VALUES ('${crypto.randomUUID()}', '${foreignRecruiterUserId}', '${companyBId}', 'RECRUITER', 'ACTIVE', now());
    `);

    // 3. Setup Candidate con perfil confirmado
    candidateToken = authFixture.tokens.c;
    const resCand = await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${candidateToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const candMeData: any = await resCand.json();
    candidateUserId = candMeData.data.user.id;
    const resCandProfile = await client.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${candidateToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const candProfileData: any = await resCandProfile.json();
    candidateProfileId = candProfileData.data.id;

    // Insertar revisión confirmada directamente con claim
    confirmedRevisionId = crypto.randomUUID();
    const dummyDigest = "a".repeat(64);
    await dbFixture.admin.query(`
      ALTER TABLE app."CompetencyClaim" DISABLE TRIGGER ALL;
      ALTER TABLE app."ProfileRevision" DISABLE TRIGGER ALL;

      INSERT INTO app."ProfileRevision" (
        id, "profileId", status, revision, "versionNumber", "displayName",
        "confirmedAt", "confirmedById", "snapshotDigest", "updatedAt"
      ) VALUES (
        '${confirmedRevisionId}', '${candidateProfileId}', 'CONFIRMED', 1, 1, 'Candidato Demo',
        now(), '${candidateUserId}', '${dummyDigest}', now()
      );

      UPDATE app."CandidateProfile"
      SET "currentVersionId" = '${confirmedRevisionId}'
      WHERE id = '${candidateProfileId}';

      INSERT INTO app."CompetencyClaim" (id, "profileId", "revisionId", "competencyId", "catalogVersionId", "originalText", criterion, decision)
      VALUES ('${crypto.randomUUID()}', '${candidateProfileId}', '${confirmedRevisionId}', '${competency1Id}', '${catalogVersionId}', 'Control de inventarios y stock', 'Criterio aceptado', 'ACCEPTED');

      ALTER TABLE app."ProfileRevision" ENABLE TRIGGER ALL;
      ALTER TABLE app."CompetencyClaim" ENABLE TRIGGER ALL;
    `);
  }, 30000);

  afterAll(async () => {
    await dbFixture.close();
    authFixture.stop();
  });

  it("1. Empresa describe vacante en texto y A01 propone puesto y habilidades", async () => {
    const res = await client.request(`/api/v1/organizations/${companyAId}/drafts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${recruiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_text: "Buscamos personal para nuestro centro logístico en Juan Díaz. Se encargará del control de inventarios, recepción y clasificación de mercancías. Horario de lunes a viernes de 8am a 5pm. Salario $750 mensual. 2 plazas disponibles.",
        location: "Juan Díaz, Panamá",
        salary_amount: 750,
        salary_period: "MONTH",
        available_slots: 2,
      }),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe("READY_TO_PUBLISH");
    expect(body.data.title).toBe("Auxiliar de Bodega e Inventario");
    expect(body.data.occupation_id).toBe(occupationId);
    expect(body.data.proposed_requirements.length).toBe(2);
    expect(body.data.clarification_questions.length).toBeGreaterThan(0);
    expect(body.data.has_blocking_issues).toBe(false);

    activeDraftId = body.data.id;
  });

  it("2. Términos discriminatorios bloquean la publicación y NO pueden eludirse", async () => {
    // Crear borrador con sesgo de edad y apariencia física
    const resDiscDraft = await client.request(`/api/v1/organizations/${companyAId}/drafts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${recruiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_text: "Se busca señorita de buena presencia para atención, edad máxima 25 años. Soltera sin hijos.",
        location: "Ciudad de Panamá",
      }),
    });

    expect(resDiscDraft.status).toBe(201);
    const discDraft: any = await resDiscDraft.json();
    expect(discDraft.data.has_blocking_issues).toBe(true);
    expect(discDraft.data.discriminatory_warnings.length).toBeGreaterThanOrEqual(1);

    // Intentar publicar debe retornar 422 DISCRIMINATORY_TERMS_BLOCKED
    const resPublishBlocked = await client.request(`/api/v1/organizations/${companyAId}/drafts/${discDraft.data.id}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${recruiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Recepcionista",
        occupation_id: occupationId,
        location: "Ciudad de Panamá",
        workplace_type: "ON_SITE",
        requirements: [
          {
            competency_id: competency1Id,
            requirement_type: "ESSENTIAL",
            stage: "ENTRY",
            description: "Atención y buena presencia física",
          },
        ],
      }),
    });

    expect(resPublishBlocked.status).toBe(422);
    const errBody: any = await resPublishBlocked.json();
    expect(errBody.error.code).toBe("DISCRIMINATORY_TERMS_BLOCKED");
  });

  it("3. Reclutador confirma y publica la vacante validada; reintento no duplica", async () => {
    const publishPayload = {
      title: "Auxiliar de Bodega e Inventario",
      occupation_id: occupationId,
      location: "Juan Díaz, Panamá",
      workplace_type: "ON_SITE",
      salary_amount: 750,
      salary_period: "MONTH",
      schedule_summary: "Lunes a viernes 08:00 a 17:00",
      available_slots: 2,
      requirements: [
        {
          competency_id: competency1Id,
          requirement_type: "ESSENTIAL" as const,
          stage: "ENTRY" as const,
          description: "Control de entradas y salidas de mercancía",
        },
        {
          competency_id: competency2Id,
          requirement_type: "DESIRABLE" as const,
          stage: "TRAINABLE" as const,
          description: "Operación de transpaleta manual",
        },
      ],
    };

    // Publicación
    const resPub = await client.request(`/api/v1/organizations/${companyAId}/drafts/${activeDraftId}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${recruiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(publishPayload),
    });

    if (resPub.status !== 201) {
      console.log("resPub error:", await resPub.text());
    }
    expect(resPub.status).toBe(201);
    const pubBody: any = await resPub.json();
    expect(pubBody.data.id).toBeDefined();
    expect(pubBody.data.title).toBe("Auxiliar de Bodega e Inventario");
    expect(pubBody.data.available_slots).toBe(2);
    expect(pubBody.data.requirements.length).toBe(2);

    publishedOpportunityId = pubBody.data.id;

    // Idempotencia: segundo intento devuelve la misma vacante sin duplicar
    const resPubReplay = await client.request(`/api/v1/organizations/${companyAId}/drafts/${activeDraftId}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${recruiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(publishPayload),
    });

    expect(resPubReplay.status).toBe(201);
    const replayBody: any = await resPubReplay.json();
    expect(replayBody.data.id).toBe(publishedOpportunityId);
  });

  it("4. Joven consulta la vacante publicada mediante explorador", async () => {
    const resOpp = await client.request(`/api/v1/opportunities/${publishedOpportunityId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${candidateToken}` },
    });

    expect(resOpp.status).toBe(200);
    const body: any = await resOpp.json();
    expect(body.data.title).toBe("Auxiliar de Bodega e Inventario");
    expect(body.data.organization.name).toBe("Logística Panamá S.A.");
  });

  it("5. Joven autoriza candidatura con versión confirmada y recibo; postular NO consume plazas", async () => {
    // Verificar cupos antes de postular
    const resBefore = await client.request(`/api/v1/opportunities/${publishedOpportunityId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${candidateToken}` },
    });
    const beforeData: any = await resBefore.json();
    expect(beforeData.data.available_slots).toBe(2);

    // Postulación consentida
    const resApply = await client.request(`/api/v1/opportunities/${publishedOpportunityId}/applications`, {
      method: "POST",
      headers: { Authorization: `Bearer ${candidateToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_revision_id: confirmedRevisionId,
        consent_confirmed: true,
      }),
    });

    expect(resApply.status).toBe(201);
    const applyBody: any = await resApply.json();
    expect(applyBody.data.id).toBeDefined();
    expect(applyBody.data.status).toBe("ACTIVE");
    expect(applyBody.data.receipt_number).toMatch(/^REC-APP-/);
    candidateApplicationId = applyBody.data.id;

    // Verificar que available_slots NO se decrementó
    const resAfter = await client.request(`/api/v1/opportunities/${publishedOpportunityId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${candidateToken}` },
    });
    const afterData: any = await resAfter.json();
    expect(afterData.data.available_slots).toBe(2);

    // Reintento es idempotente y no duplica
    const resApplyReplay = await client.request(`/api/v1/opportunities/${publishedOpportunityId}/applications`, {
      method: "POST",
      headers: { Authorization: `Bearer ${candidateToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_revision_id: confirmedRevisionId,
        consent_confirmed: true,
      }),
    });

    expect(resApplyReplay.status).toBe(201);
    const replayBody: any = await resApplyReplay.json();
    expect(replayBody.data.id).toBe(candidateApplicationId);
  });

  it("6. Empresa consulta habilidades y brechas en formato MINIMIZADO (sin datos personales)", async () => {
    const resApps = await client.request(
      `/api/v1/organizations/${companyAId}/opportunities/${publishedOpportunityId}/applications`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${recruiterToken}` },
      }
    );

    expect(resApps.status).toBe(200);
    const body: any = await resApps.json();
    expect(body.data.items.length).toBe(1);

    const appItem = body.data.items[0];
    expect(appItem.id).toBe(candidateApplicationId);
    expect(appItem.status).toBe("ACTIVE");
    expect(appItem.candidate_anonymized_id).toMatch(/^CAND-/);

    // REGLA CRÍTICA: La API excluye terminantemente datos personales
    expect((appItem as any).name).toBeUndefined();
    expect((appItem as any).first_name).toBeUndefined();
    expect((appItem as any).email).toBeUndefined();
    expect((appItem as any).phone).toBeUndefined();
    expect((appItem as any).gender).toBeUndefined();
    expect((appItem as any).photo).toBeUndefined();

    // Habilidades evaluadas y brechas presentes
    expect(appItem.skills.length).toBeGreaterThan(0);
    expect(appItem.gaps.length).toBe(2);
    expect(appItem.coverage_percentage).toBe(0); // Declaración sin evidencia no acredita; el otro requisito es entrenable.
    expect(appItem.skills[0].status).toBe('DECLARADO');
    expect(appItem.gaps.find((gap:any)=>gap.competency_id===competency1Id).status).toBe('DESCONOCIDO');
    expect(appItem.feasibility).toBe('PENDIENTE');
  });

  it("7. Empresa ajena NO accede a las candidaturas (403/404)", async () => {
    const resForeign = await client.request(
      `/api/v1/organizations/${companyAId}/opportunities/${publishedOpportunityId}/applications`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${foreignRecruiterToken}` },
      }
    );

    expect(resForeign.status).toBe(403);
    const errBody: any = await resForeign.json();
    expect(errBody.error.code).toBe("ORGANIZATION_ACCESS_DENIED");
  });

  it("8. Joven retira su candidatura; empresa pierde inmediatamente acceso a las habilidades", async () => {
    // Retirar postulación
    const resWithdraw = await client.request(`/api/v1/me/applications/${candidateApplicationId}/withdrawal`, {
      method: "POST",
      headers: { Authorization: `Bearer ${candidateToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Encontré otra opción formativa" }),
    });

    expect(resWithdraw.status).toBe(200);
    const withdrawBody: any = await resWithdraw.json();
    expect(withdrawBody.data.status).toBe("WITHDRAWN");
    expect(withdrawBody.data.withdrawn_at).toBeDefined();

    // La revocación también retira la candidatura de la consulta empresarial.
    const resAppsAfter = await client.request(
      `/api/v1/organizations/${companyAId}/opportunities/${publishedOpportunityId}/applications`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${recruiterToken}` },
      }
    );

    expect(resAppsAfter.status).toBe(200);
    const bodyAfter: any = await resAppsAfter.json();
    expect(bodyAfter.data.items).toEqual([]);
  });
});
