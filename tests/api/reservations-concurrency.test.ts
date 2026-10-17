import { it, expect, describe, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { ReservationsService } from "../../apps/api/src/modules/reservations/reservations.service";
import { CoursesService } from "../../apps/api/src/modules/courses/courses.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";

describe("D4-C Reservations Concurrency, Atomic Locks & Idempotency", () => {
  let dbFixture: DatabaseFixture;
  let authFixture: AuthFixture;
  let client: ReturnType<typeof createApp>;
  let userTokenA: string;
  let userTokenB: string;

  const trainingCenterOrgId = "90000000-0000-4000-8000-000000000003";
  const catalogVersionId = "c0000000-0000-4000-8000-000000000003";
  const prereqCompId = "11111111-0000-4000-8000-000000000003";
  const outcomeCompId = "22222222-0000-4000-8000-000000000003";

  // Cursos y Ediciones
  const coursePrereqId = "c1000000-0000-4000-8000-000000000003";
  const versionPrereqId = "b1000000-0000-4000-8000-000000000003";
  const editionPrereqId = "e1000000-0000-4000-8000-000000000003";

  const courseCompeteId = "c2000000-0000-4000-8000-000000000003";
  const versionCompeteId = "b2000000-0000-4000-8000-000000000003";
  const editionCompeteId = "e2000000-0000-4000-8000-000000000003"; // 1 solo cupo

  const courseCollisionId = "c3000000-0000-4000-8000-000000000003";
  const versionCollisionId = "b3000000-0000-4000-8000-000000000003";
  const editionCollisionId = "e3000000-0000-4000-8000-000000000003"; // Colisiona con editionCompeteId

  async function bootstrapAndConfirmUser(token: string, authSubId: string, hasPrereq: boolean) {
    // 1. Bootstrap AppUser
    await client.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const profInitRes = await client.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(profInitRes.status).toBe(200);

    // 2. Crear borrador de perfil
    const resDraft = await client.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `draft-key-${authSubId.substring(0, 8)}`,
      },
      body: JSON.stringify({}),
    });
    expect(resDraft.status).toBe(201);
    const draftBody = (await resDraft.json()) as any;
    const draftId = draftBody.data.id;

    // 3. Obtener id de CandidateProfile
    const profRow = await dbFixture.admin.query<{ id: string; ownerUserId: string }>(
      `SELECT "id", "ownerUserId" FROM app."CandidateProfile" WHERE "ownerUserId" = (SELECT id FROM app."AppUser" WHERE "authSubject" = $1)`,
      [authSubId]
    );
    const profileId = profRow.rows[0].id;

    // 4. Parchear constraints y disponibilidad válida
    await client.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "If-Match": "1" },
      body: JSON.stringify({
        section: "identity",
        values: { display_name: `Candidato ${authSubId.substring(0, 5)}` },
      }),
    });

    await client.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "If-Match": "2" },
      body: JSON.stringify({
        section: "constraints",
        values: {
          salary_state: "KNOWN",
          minimum_salary: "750.00",
          salary_currency: "USD",
          salary_period: "MONTH",
          travel_limit_state: "KNOWN",
          max_one_way_minutes: 60,
          location_state: "KNOWN",
          approximate_zone: "Panamá Centro",
          availability_state: "KNOWN",
          mobility_state: "UNKNOWN",
          transport_state: "UNKNOWN",
          training_state: "KNOWN",
          training_budget: "100.00",
          training_currency: "USD",
          training_period: "TOTAL",
        },
      }),
    });

    // 5. Insertar disponibilidad y opcionalmente evidencia y claim aceptado para el prerrequisito
    if (hasPrereq) {
      await dbFixture.admin.query(`
        WITH new_src AS (
          INSERT INTO app."ProfileSource" (
            "id", "profileId", "kind", "status", "sha256", "mediaType", "sizeBytes", "manualText"
          ) VALUES (
            gen_random_uuid(), '${profileId}', 'MANUAL_TEXT', 'READY', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'text/plain', 50, 'Prerrequisito Acreditado'
          ) RETURNING id
        ),
        new_frag AS (
          INSERT INTO app."SourceFragment" (
            "id", "profileId", "sourceId", "text"
          ) SELECT gen_random_uuid(), '${profileId}', id, 'Prerrequisito Acreditado' FROM new_src
          RETURNING id
        ),
        new_ev AS (
          INSERT INTO app."ProfileEvidence" (
            "id", "profileId", "fragmentId", "kind", "scope"
          ) SELECT gen_random_uuid(), '${profileId}', id, 'DOCUMENT', 'Certificado técnico' FROM new_frag
          RETURNING id
        ),
        new_claim AS (
          INSERT INTO app."CompetencyClaim" (
            "id", "profileId", "revisionId", "competencyId", "catalogVersionId",
            "originalText", "criterion", "decision"
          ) VALUES (
            gen_random_uuid(), '${profileId}', '${draftId}', '${prereqCompId}', '${catalogVersionId}',
            'Conocimiento acreditado', 'Evaluación', 'ACCEPTED'
          ) RETURNING id
        )
        INSERT INTO app."ProfileEvidenceLink" (
          "id", "profileId", "revisionId", "evidenceId", "claimId"
        ) VALUES (
          gen_random_uuid(), '${profileId}', '${draftId}', (SELECT id FROM new_ev), (SELECT id FROM new_claim)
        );
      `);
    }

    // Ventanas de disponibilidad
    await dbFixture.admin.query(`
      INSERT INTO app."AvailabilityWindow" (
        "id", "profileId", "revisionId", "weekday", "startMinute", "endMinute", "timezone", "validFrom", "validTo"
      ) VALUES
        (gen_random_uuid(), '${profileId}', '${draftId}', 1, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${profileId}', '${draftId}', 2, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${profileId}', '${draftId}', 3, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${profileId}', '${draftId}', 4, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${profileId}', '${draftId}', 5, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'),
        (gen_random_uuid(), '${profileId}', '${draftId}', 6, 480, 1020, 'America/Panama', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year');
    `);

    // 6. Section reviews
    for (const section of ["ACCOUNT", "EXPERIENCE", "TRAINING", "INTERESTS", "COMPETENCIES", "AVAILABILITY", "CONSTRAINTS", "FINAL_REVIEW"]) {
      await client.request("/api/v1/me/candidate-profile/draft/section-reviews", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `rev-${authSubId.substring(0, 5)}-${section.toLowerCase()}`,
        },
        body: JSON.stringify({ section, decision: "REVIEWED" }),
      });
    }

    // 7. Preview y confirmación
    const resPrev = await client.request("/api/v1/me/candidate-profile/draft/review-previews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "If-Match": "3",
        "Idempotency-Key": `prev-key-${authSubId.substring(0, 8)}`,
      },
      body: JSON.stringify({}),
    });
    expect(resPrev.status).toBe(201);
    const prevId = ((await resPrev.json()) as any).data.preview_id;

    const draftCur = await client.request("/api/v1/me/candidate-profile/draft", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const curRev = ((await draftCur.json()) as any).data.revision;

    const resConf = await client.request("/api/v1/me/candidate-profile/confirmations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "If-Match": String(curRev),
        "Idempotency-Key": `conf-key-${authSubId.substring(0, 8)}`,
      },
      body: JSON.stringify({
        draft_id: draftId,
        preview_id: prevId,
        acknowledge_partial: true,
      }),
    });
    expect(resConf.status).toBe(201);
  }

  beforeAll(async () => {
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
    const reservationsService = new ReservationsService(dbFixture.db);
    const verifyToken = createVerifyToken(config);

    client = createApp({
      identityService,
      profileService,
      coursesService,
      reservationsService,
      verifyToken,
      allowedOrigins: config.allowedOrigins,
    });

    userTokenA = authFixture.tokens.a;
    userTokenB = authFixture.tokens.b;

    // Sembrar catálogo, competencias y organización
    await dbFixture.admin.query(`
      INSERT INTO app."CatalogVersion" ("id", "code", "sourceLabel")
      VALUES ('${catalogVersionId}', 'CAT-PA-D4-RES', 'Catálogo de Reservas D4')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CompetencyEntry" ("id", "catalogVersionId", "code", "name", "description", "kind")
      VALUES
        ('${prereqCompId}', '${catalogVersionId}', 'COMP-PREREQ-01', 'Fundamentos de Electricidad', 'Prerrequisito obligatorio', 'KNOWLEDGE'),
        ('${outcomeCompId}', '${catalogVersionId}', 'COMP-OUTCOME-01', 'Instalación de Paneles Solares', 'Competencia destino', 'SKILL')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."Organization" ("id", "name", "type", "active", "updatedAt")
      VALUES ('${trainingCenterOrgId}', 'Instituto Técnico Solar UTP', 'TRAINING_CENTER', true, NOW())
      ON CONFLICT DO NOTHING;

      -- Curso 1: Requiere prerrequisito
      INSERT INTO app."Course" ("id", "organizationId", "code", "title", "description", "active", "isDemo", "createdAt", "updatedAt")
      VALUES ('${coursePrereqId}', '${trainingCenterOrgId}', 'CUR-SOLAR-01', 'Instalación Solar Avanzada', 'Curso avanzado con prerrequisito.', true, true, NOW(), NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseVersion" ("id", "courseId", "catalogVersionId", "versionNumber", "syllabusText", "durationHours", "confirmedAt")
      VALUES ('${versionPrereqId}', '${coursePrereqId}', '${catalogVersionId}', 1, 'Módulos y baterías', 40, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CoursePrerequisite" ("id", "courseVersionId", "competencyId", "catalogVersionId", "essential", "description")
      VALUES (gen_random_uuid(), '${versionPrereqId}', '${prereqCompId}', '${catalogVersionId}', true, 'Fundamentos eléctricos indispensables')
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseEdition" (
        "id", "courseVersionId", "modality", "startDate", "endDate", "totalSlots",
        "costAmount", "costCurrency", "costPeriod", "scheduleSummary", "active", "isDemo", "publishedAt"
      ) VALUES (
        '${editionPrereqId}', '${versionPrereqId}', 'ON_SITE',
        NOW() + INTERVAL '10 days', NOW() + INTERVAL '30 days', 5,
        50.00, 'USD', 'TOTAL', 'Sábados 08:00 - 12:00', true, true, NOW()
      ) ON CONFLICT DO NOTHING;

      -- Curso 2: 1 solo cupo para prueba de concurrencia extrema (sin prerrequisitos)
      INSERT INTO app."Course" ("id", "organizationId", "code", "title", "description", "active", "isDemo", "createdAt", "updatedAt")
      VALUES ('${courseCompeteId}', '${trainingCenterOrgId}', 'CUR-LAST-01', 'Taller de Soldadura Básica', 'Última plaza disponible.', true, true, NOW(), NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseVersion" ("id", "courseId", "catalogVersionId", "versionNumber", "syllabusText", "durationHours", "confirmedAt")
      VALUES ('${versionCompeteId}', '${courseCompeteId}', '${catalogVersionId}', 1, 'Soldadura por arco', 20, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseEdition" (
        "id", "courseVersionId", "modality", "startDate", "endDate", "totalSlots",
        "costAmount", "costCurrency", "costPeriod", "scheduleSummary", "active", "isDemo", "publishedAt"
      ) VALUES (
        '${editionCompeteId}', '${versionCompeteId}', 'ON_SITE',
        NOW() + INTERVAL '5 days', NOW() + INTERVAL '25 days', 1,
        25.00, 'USD', 'TOTAL', 'Sábados 08:00 - 12:00', true, true, NOW()
      ) ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseSession" ("id", "editionId", "weekday", "startMinute", "endMinute", "timezone")
      VALUES (gen_random_uuid(), '${editionCompeteId}', 6, 480, 720, 'America/Panama')
      ON CONFLICT DO NOTHING;

      -- Curso 3: Horario colisionante con Curso 2 (Sábados 09:00 - 13:00)
      INSERT INTO app."Course" ("id", "organizationId", "code", "title", "description", "active", "isDemo", "createdAt", "updatedAt")
      VALUES ('${courseCollisionId}', '${trainingCenterOrgId}', 'CUR-COL-01', 'Taller de Carpintería', 'Curso en horario colisionante.', true, true, NOW(), NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseVersion" ("id", "courseId", "catalogVersionId", "versionNumber", "syllabusText", "durationHours", "confirmedAt")
      VALUES ('${versionCollisionId}', '${courseCollisionId}', '${catalogVersionId}', 1, 'Maderas y cortes', 20, NOW())
      ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseEdition" (
        "id", "courseVersionId", "modality", "startDate", "endDate", "totalSlots",
        "costAmount", "costCurrency", "costPeriod", "scheduleSummary", "active", "isDemo", "publishedAt"
      ) VALUES (
        '${editionCollisionId}', '${versionCollisionId}', 'ON_SITE',
        NOW() + INTERVAL '5 days', NOW() + INTERVAL '25 days', 5,
        30.00, 'USD', 'TOTAL', 'Sábados 09:00 - 13:00', true, true, NOW()
      ) ON CONFLICT DO NOTHING;

      INSERT INTO app."CourseSession" ("id", "editionId", "weekday", "startMinute", "endMinute", "timezone")
      VALUES (gen_random_uuid(), '${editionCollisionId}', 6, 540, 780, 'America/Panama')
      ON CONFLICT DO NOTHING;
    `);

    // Bootstrap Candidato A (con prerrequisito acreditado)
    await bootstrapAndConfirmUser(userTokenA, authFixture.users.a.id, true);

    // Bootstrap Candidato B (sin prerrequisito acreditado)
    await bootstrapAndConfirmUser(userTokenB, authFixture.users.b.id, false);
  }, 30000);

  afterAll(async () => {
    authFixture?.stop();
    await dbFixture?.db.close();
  });

  it("CASE-D4-07: rejects reservation when candidate lacks mandatory prerequisites with 409", async () => {
    // Candidato B no tiene el prerrequisito
    const res = await client.request("/api/v1/me/course-reservations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userTokenB}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-res-prereq-fail-001",
      },
      body: JSON.stringify({
        edition_id: editionPrereqId,
      }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("PREREQUISITES_NOT_MET");
  });

  it("CASE-D4-09: allows reservation when candidate meets mandatory prerequisites", async () => {
    // Candidato A sí tiene el prerrequisito
    const res = await client.request("/api/v1/me/course-reservations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userTokenA}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-res-prereq-success-001",
      },
      body: JSON.stringify({
        edition_id: editionPrereqId,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.status).toBe("CONFIRMED");
    expect(body.data.course_title).toBe("Instalación Solar Avanzada");
    expect(body.data.reservation_number).toMatch(/^RES-\d{8}-[A-Z0-9]+$/);
    expect(body.data.remaining_slots).toBe(4);
  });

  it("CASE-D4-10: two candidates competing for the last 1 slot: exactly one succeeds and one receives 409 NO_AVAILABLE_SLOTS", async () => {
    // editionCompeteId tiene totalSlots = 1 y 0 reservas activas
    const keyA = "test-compete-slot-key-cand-a";
    const keyB = "test-compete-slot-key-cand-b";

    const [resA, resB] = await Promise.all([
      client.request("/api/v1/me/course-reservations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userTokenA}`,
          "Content-Type": "application/json",
          "Idempotency-Key": keyA,
        },
        body: JSON.stringify({ edition_id: editionCompeteId }),
      }),
      client.request("/api/v1/me/course-reservations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userTokenB}`,
          "Content-Type": "application/json",
          "Idempotency-Key": keyB,
        },
        body: JSON.stringify({ edition_id: editionCompeteId }),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const winnerRes = resA.status === 201 ? resA : resB;
    const loserRes = resA.status === 409 ? resA : resB;

    const winnerBody = (await winnerRes.json()) as any;
    const loserBody = (await loserRes.json()) as any;

    expect(winnerBody.data.status).toBe("CONFIRMED");
    expect(winnerBody.data.remaining_slots).toBe(0);
    expect(loserBody.error.code).toBe("NO_AVAILABLE_SLOTS");
  });

  it("CASE-D4-11: rejects reservation if it collides with another active reservation on candidate schedule", async () => {
    // Candidato A ya tiene reservada editionPrereqId o editionCompeteId
    // Intentar reservar editionCollisionId (Sábados 09:00 - 13:00) colisiona con (Sábados 08:00 - 12:00)
    const res = await client.request("/api/v1/me/course-reservations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userTokenA}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-res-collision-001",
      },
      body: JSON.stringify({
        edition_id: editionCollisionId,
      }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("SCHEDULE_COLLISION");
  });

  it("CASE-D4-12: exact idempotency replay with same key and body returns 200 OK and identical reservation receipt", async () => {
    const replayRes = await client.request("/api/v1/me/course-reservations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userTokenA}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-res-prereq-success-001", // Misma clave que el caso previo exitoso
      },
      body: JSON.stringify({
        edition_id: editionPrereqId,
      }),
    });

    expect(replayRes.status).toBe(200);
    const body = (await replayRes.json()) as any;
    expect(body.data.status).toBe("CONFIRMED");
    expect(body.data.course_title).toBe("Instalación Solar Avanzada");
  });

  it("CASE-D4-13: idempotency conflict: reusing same key with different body returns 409 IDEMPOTENCY_CONFLICT", async () => {
    const conflictRes = await client.request("/api/v1/me/course-reservations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userTokenA}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-res-prereq-success-001", // Misma clave
      },
      body: JSON.stringify({
        edition_id: editionCollisionId, // Cuerpo distinto
      }),
    });

    expect(conflictRes.status).toBe(409);
    const body = (await conflictRes.json()) as any;
    expect(body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("recovers operation receipt by idempotency key", async () => {
    const receiptRes = await client.request(
      "/api/v1/me/course-reservation-operations/test-res-prereq-success-001",
      {
        headers: { Authorization: `Bearer ${userTokenA}` },
      }
    );

    expect(receiptRes.status).toBe(200);
    const body = (await receiptRes.json()) as any;
    expect(body.data.operation).toBe("COURSE_RESERVATION");
    expect(body.data.idempotency_key).toBe("test-res-prereq-success-001");
    expect(body.data.payload.course_title).toBe("Instalación Solar Avanzada");
  });

  it("CASE-D4-14: cancellation releases 1 slot, repeated cancellation is idempotent without double freeing", async () => {
    // 1. Obtener la reserva activa de Candidato A en editionPrereqId
    const listRes = await client.request("/api/v1/me/course-reservations", {
      headers: { Authorization: `Bearer ${userTokenA}` },
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as any;
    const targetReservation = listBody.data.items.find((r: any) => r.edition_id === editionPrereqId);
    expect(targetReservation).toBeDefined();
    expect(targetReservation.status).toBe("CONFIRMED");

    // 2. Cancelar la reserva
    const cancelRes = await client.request(
      `/api/v1/me/course-reservations/${targetReservation.id}/cancellations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userTokenA}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "test-cancel-key-001",
        },
        body: JSON.stringify({
          reason: "Imprevisto laboral, no podré asistir a las clases de los sábados.",
        }),
      }
    );

    expect(cancelRes.status).toBe(200);
    const cancelBody = (await cancelRes.json()) as any;
    expect(cancelBody.data.status).toBe("CANCELLED");
    expect(cancelBody.data.cancelled_at).toBeTruthy();
    expect(cancelBody.data.remaining_slots).toBe(5); // El cupo volvió a 5

    // 3. Cancelación repetida sobre la misma reserva: idempotencia exacta sin volver a liberar
    const repeatedCancelRes = await client.request(
      `/api/v1/me/course-reservations/${targetReservation.id}/cancellations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userTokenA}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "test-cancel-key-002",
        },
        body: JSON.stringify({
          reason: "Intento repetido de cancelación.",
        }),
      }
    );

    expect(repeatedCancelRes.status).toBe(200);
    const repBody = (await repeatedCancelRes.json()) as any;
    expect(repBody.data.status).toBe("CANCELLED");
    expect(repBody.data.remaining_slots).toBe(5); // Sigue siendo 5, no se sumó una segunda vez a 6
  });

  it("CASE-D4-15: foreign candidate cannot access or cancel someone else's reservation (returns 404)", async () => {
    // Obtener la reserva que ganó en editionCompeteId
    const resA = await client.request("/api/v1/me/course-reservations", {
      headers: { Authorization: `Bearer ${userTokenA}` },
    });
    const itemsA = ((await resA.json()) as any).data.items;
    const aCompeteRes = itemsA.find((r: any) => r.edition_id === editionCompeteId);

    if (aCompeteRes) {
      // Candidato B intenta acceder a la reserva de Candidato A
      const foreignGet = await client.request(`/api/v1/me/course-reservations/${aCompeteRes.id}`, {
        headers: { Authorization: `Bearer ${userTokenB}` },
      });
      expect(foreignGet.status).toBe(404);

      // Candidato B intenta cancelar la reserva de Candidato A
      const foreignCancel = await client.request(
        `/api/v1/me/course-reservations/${aCompeteRes.id}/cancellations`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${userTokenB}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Intento de cancelación ajeno" }),
        }
      );
      expect(foreignCancel.status).toBe(404);
    }
  });

  it("derives agenda events strictly from active confirmed reservations", async () => {
    // Agenda de Candidato A
    const agendaRes = await client.request("/api/v1/me/agenda", {
      headers: { Authorization: `Bearer ${userTokenA}` },
    });

    expect(agendaRes.status).toBe(200);
    const agendaBody = (await agendaRes.json()) as any;
    expect(Array.isArray(agendaBody.data.events)).toBe(true);

    // Como editionPrereqId fue cancelada, no debe aparecer en la agenda de eventos confirmados
    const cancelledEvents = agendaBody.data.events.filter(
      (e: any) => e.course_title === "Instalación Solar Avanzada"
    );
    expect(cancelledEvents.length).toBe(0);
  });
});
