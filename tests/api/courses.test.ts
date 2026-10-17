import { it, expect, describe, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { CoursesService } from "../../apps/api/src/modules/courses/courses.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";

describe("D4-A Courses Catalog & Detail API", () => {
  let dbFixture: DatabaseFixture;
  let authFixture: AuthFixture;
  let client: ReturnType<typeof createApp>;
  let userToken: string;

  const trainingCenterOrgId = "90000000-0000-4000-8000-000000000002";
  const catalogVersionId = "c0000000-0000-4000-8000-000000000001";
  const competency1Id = "11111111-0000-4000-8000-000000000001";
  const competency2Id = "22222222-0000-4000-8000-000000000002";

  const course1Id = "c1000000-0000-4000-8000-000000000001";
  const course2InactiveId = "c2000000-0000-4000-8000-000000000002";
  const version1Id = "b1000000-0000-4000-8000-000000000001";
  const edition1Id = "e1000000-0000-4000-8000-000000000001";

  beforeAll(async () => {
    dbFixture = await setupTestDatabase();
    authFixture = startAuthFixture(55442);

    const config = {
      ...dbFixture.config,
      supabaseUrl: authFixture.url,
      allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
    };

    const identityService = new IdentityService(dbFixture.db);
    const coursesService = new CoursesService(dbFixture.db);
    const verifyToken = createVerifyToken(config);

    client = createApp({
      identityService,
      coursesService,
      verifyToken,
      allowedOrigins: config.allowedOrigins,
    });

    userToken = authFixture.tokens.a;

    // Bootstrap User A
    await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    // Seed Training Center, Competencies, and Courses
    await dbFixture.admin.query(`
      INSERT INTO app."CatalogVersion" ("id", "code", "sourceLabel")
      VALUES ('${catalogVersionId}', 'CAT-PA-2026', 'Catálogo Nacional de Competencias Demo')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CompetencyEntry" ("id", "catalogVersionId", "code", "name", "description", "kind")
      VALUES
        ('${competency1Id}', '${catalogVersionId}', 'COMP-INV-01', 'Registro de inventario', 'Registro físico y digital de existencias', 'SKILL'),
        ('${competency2Id}', '${catalogVersionId}', 'COMP-MATH-01', 'Operaciones aritméticas básicas', 'Cálculos de suma y resta aplicados al almacén', 'KNOWLEDGE')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Organization" ("id", "name", "type", "active", "updatedAt")
      VALUES ('${trainingCenterOrgId}', 'Centro de Formación Técnica UTP', 'TRAINING_CENTER', true, NOW())
      ON CONFLICT DO NOTHING;

      -- Active Course 1
      INSERT INTO app."Course" ("id", "organizationId", "code", "title", "description", "active", "isDemo", "createdAt", "updatedAt")
      VALUES ('${course1Id}', '${trainingCenterOrgId}', 'CUR-INV-01', 'Control y Gestión de Inventarios Básicos', 'Curso práctico sobre registro de entradas, salidas y kardex.', true, true, NOW(), NOW())
      ON CONFLICT DO NOTHING;

      -- Inactive Course 2
      INSERT INTO app."Course" ("id", "organizationId", "code", "title", "description", "active", "isDemo", "createdAt", "updatedAt")
      VALUES ('${course2InactiveId}', '${trainingCenterOrgId}', 'CUR-OLD-01', 'Taller Archivístico Antiguo', 'Curso descatalogado.', false, true, NOW(), NOW())
      ON CONFLICT DO NOTHING;

      -- Course 1 Version
      INSERT INTO app."CourseVersion" ("id", "courseId", "catalogVersionId", "versionNumber", "syllabusText", "durationHours", "confirmedAt", "createdAt")
      VALUES ('${version1Id}', '${course1Id}', '${catalogVersionId}', 1, 'Módulo 1: Almacén. Módulo 2: Kardex y existencias.', 40, NOW(), NOW())
      ON CONFLICT DO NOTHING;

      -- Learning Outcome & Prerequisite
      INSERT INTO app."CourseLearningOutcome" ("id", "courseVersionId", "competencyId", "catalogVersionId", "description", "createdAt")
      VALUES (gen_random_uuid(), '${version1Id}', '${competency1Id}', '${catalogVersionId}', 'Capacidad de registrar movimientos en kardex digital', NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CoursePrerequisite" ("id", "courseVersionId", "competencyId", "catalogVersionId", "essential", "description", "createdAt")
      VALUES (gen_random_uuid(), '${version1Id}', '${competency2Id}', '${catalogVersionId}', true, 'Manejo de sumas y restas para balance de existencias', NOW())
      ON CONFLICT DO NOTHING;

      -- Course Edition
      INSERT INTO app."CourseEdition" (
        "id", "courseVersionId", "modality", "location", "startDate", "endDate",
        "totalSlots", "availableSlots", "costAmount", "costCurrency", "costPeriod",
        "scheduleSummary", "active", "isDemo", "version", "publishedAt"
      ) VALUES (
        '${edition1Id}', '${version1Id}', 'ON_SITE', 'Sede Central UTP, Aula B-12',
        CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '35 days',
        10, 10, 0.00, 'USD', 'TOTAL',
        'Sábados 08:00 - 12:00', true, true, 1, NOW()
      ) ON CONFLICT DO NOTHING;

      -- Course Sessions (Saturdays 08:00 - 12:00)
      INSERT INTO app."CourseSession" ("id", "editionId", "weekday", "startMinute", "endMinute", "timezone", "location")
      VALUES (gen_random_uuid(), '${edition1Id}', 6, 480, 720, 'America/Panama', 'Aula B-12')
      ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    if (authFixture) authFixture.stop();
    if (dbFixture) await dbFixture.close();
  });

  it("lists active courses and excludes inactive ones", async () => {
    const res = await client.request("/api/v1/courses", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data.items).toBeDefined();
    expect(json.data.items.length).toBe(1);

    const course = json.data.items[0];
    expect(course.id).toBe(course1Id);
    expect(course.code).toBe("CUR-INV-01");
    expect(course.title).toBe("Control y Gestión de Inventarios Básicos");
    expect(course.organization.name).toBe("Centro de Formación Técnica UTP");
    expect(course.active_editions_count).toBe(1);
    expect(course.next_start_date).toBeDefined();
  });

  it("filters courses by query search term 'Inventarios'", async () => {
    const res = await client.request("/api/v1/courses?q=Inventarios", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data.items.length).toBe(1);
  });

  it("returns empty list when query search matches nothing", async () => {
    const res = await client.request("/api/v1/courses?q=RoboticaAvanzadaInexistente", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data.items.length).toBe(0);
    expect(json.data.pagination.total).toBe(0);
  });

  it("filters courses by modality 'ON_SITE'", async () => {
    const res = await client.request("/api/v1/courses?modality=ON_SITE", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data.items.length).toBe(1);
  });

  it("filters courses by modality 'REMOTE' returning 0 matches", async () => {
    const res = await client.request("/api/v1/courses?modality=REMOTE", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data.items.length).toBe(0);
  });

  it("retrieves full course detail with learning outcomes, prerequisites and editions", async () => {
    const res = await client.request(`/api/v1/courses/${course1Id}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    const detail = json.data;

    expect(detail.id).toBe(course1Id);
    expect(detail.version.syllabus_text).toContain("Kardex");
    expect(detail.version.duration_hours).toBe(40);

    // Learning outcome
    expect(detail.learning_outcomes.length).toBe(1);
    expect(detail.learning_outcomes[0].competency_name).toBe("Registro de inventario");

    // Prerequisite
    expect(detail.prerequisites.length).toBe(1);
    expect(detail.prerequisites[0].competency_name).toBe("Operaciones aritméticas básicas");
    expect(detail.prerequisites[0].essential).toBe(true);

    // Editions and sessions
    expect(detail.editions.length).toBe(1);
    const edition = detail.editions[0];
    expect(edition.id).toBe(edition1Id);
    expect(edition.modality).toBe("ON_SITE");
    expect(edition.total_slots).toBe(10);
    expect(edition.available_slots).toBe(10);
    expect(edition.cost_amount).toBe("0.00");
    expect(edition.sessions.length).toBe(1);
    expect(edition.sessions[0].weekday).toBe(6);
    expect(edition.sessions[0].start_minute).toBe(480);
    expect(edition.sessions[0].end_minute).toBe(720);
  });

  it("returns 404 for an inactive course", async () => {
    const res = await client.request(`/api/v1/courses/${course2InactiveId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(404);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("COURSE_NOT_FOUND");
  });

  it("returns 404 for a nonexistent course UUID", async () => {
    const res = await client.request("/api/v1/courses/00000000-0000-4000-8000-000000000000", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed course ID parameter", async () => {
    const res = await client.request("/api/v1/courses/invalid-uuid-format", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("INVALID_ID");
  });
});
