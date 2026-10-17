import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";
import type { Hono } from "hono";
import type { AppEnv } from "../../apps/api/src/app";

describe("D2-A1 Integration Candidate Profile & Draft Concurrency", () => {
  let auth: AuthFixture;
  let dbFixture: DatabaseFixture;
  let app: Hono<AppEnv>;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    auth = startAuthFixture(0);
    dbFixture = await setupTestDatabase();

    const verifyToken = createVerifyToken({ ...dbFixture.config, supabaseUrl: auth.url });
    const identityService = new IdentityService(dbFixture.db);
    const profileService = new ProfileService(dbFixture.db);

    app = createApp({
      identityService,
      profileService,
      verifyToken,
      allowedOrigins: dbFixture.config.allowedOrigins,
    });

    // Bootstrap User A
    const resA = await app.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    userAId = bodyA.data.user.id;

    // Ensure Candidate Profile for User A
    const profA = await app.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(profA.status).toBe(200);

    // Bootstrap User B
    const resB = await app.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.b}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resB.status).toBe(200);
    const bodyB = await resB.json();
    userBId = bodyB.data.user.id;

    // Ensure Candidate Profile for User B
    const profB = await app.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.b}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(profB.status).toBe(200);
  }, 60000);

  afterAll(async () => {
    if (auth) auth.stop();
    if (dbFixture) await dbFixture.close();
  });

  it("returns 404 when querying active draft before any draft is created", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("rejects POST /drafts without Idempotency-Key or with invalid key length", async () => {
    const noKey = await app.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(noKey.status).toBe(400);
    const noKeyBody = await noKey.json();
    expect(noKeyBody.error.code).toBe("INVALID_REQUEST");

    const shortKey = await app.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "short",
      },
      body: JSON.stringify({}),
    });
    expect(shortKey.status).toBe(400);
  });

  it("creates a new draft with revision 1 and returns 201 with ETag header", async () => {
    const key = "key-create-draft-user-a-001";
    const res = await app.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ base_version_id: null }),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get("etag")).toBe("1");

    const body = await res.json();
    expect(body.data.revision).toBe(1);
    expect(body.data.status).toBe("DRAFT");
    expect(body.data.display_name).toBeNull();
    expect(body.data.headline).toBeNull();
    expect(body.data.base_version_id).toBeNull();
  });

  it("replays POST /drafts with the same Idempotency-Key and payload returning 200 with saved receipt", async () => {
    const key = "key-create-draft-user-a-001";
    const res = await app.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ base_version_id: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.revision).toBe(1);
    expect(body.data.status).toBe("DRAFT");
  });

  it("rejects POST /drafts with the same Idempotency-Key but different payload with 409", async () => {
    const key = "key-create-draft-user-a-001";
    const res = await app.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ base_version_id: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("fetches active draft via GET and retrieves ETag 1", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe("1");
    const body = await res.json();
    expect(body.data.revision).toBe(1);
  });

  it("explains a missing profile name before attempting confirmation", async () => {
    const headers = { Authorization: 'Bearer ' + auth.tokens.a };
    const currentResponse = await app.request('/api/v1/me/candidate-profile/draft', { headers });
    const current = (await currentResponse.json()).data;
    const response = await app.request('/api/v1/me/candidate-profile/confirmations', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'If-Match': '1', 'Idempotency-Key': 'confirmation-missing-name-test' },
      body: JSON.stringify({ draft_id: current.id, preview_id: crypto.randomUUID(), acknowledge_partial: true }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('PROFILE_NAME_REQUIRED');
  });

  it("rejects PATCH /draft without If-Match header with 428 PRECONDITION_REQUIRED", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        section: "identity",
        values: { display_name: "Ana Demo", headline: "Programadora Junior" },
      }),
    });

    expect(res.status).toBe(428);
    const body = await res.json();
    expect(body.error.code).toBe("PRECONDITION_REQUIRED");
  });

  it("updates identity with valid If-Match and increments revision to 2 with ETag 2", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "1",
      },
      body: JSON.stringify({
        section: "identity",
        values: { display_name: "Ana Demo", headline: "Programadora Junior" },
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe("2");
    const body = await res.json();
    expect(body.data.display_name).toBe("Ana Demo");
    expect(body.data.headline).toBe("Programadora Junior");
    expect(body.data.revision).toBe(2);
  });

  it("rejects PATCH with stale If-Match 1 returning 412 DRAFT_REVISION_CONFLICT", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "1",
      },
      body: JSON.stringify({
        section: "identity",
        values: { display_name: "Nombre Conflictivo" },
      }),
    });

    expect(res.status).toBe(412);
    const body = await res.json();
    expect(body.error.code).toBe("DRAFT_REVISION_CONFLICT");

    // Verify existing state was not overwritten
    const check = await app.request("/api/v1/me/candidate-profile/draft", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    const checkBody = await check.json();
    expect(checkBody.data.display_name).toBe("Ana Demo");
    expect(checkBody.data.revision).toBe(2);
  });

  it("handles concurrent PATCH requests: exactly one succeeds and the other receives 412", async () => {
    const req1 = app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "2",
      },
      body: JSON.stringify({
        section: "identity",
        values: { display_name: "Mutación Pestaña 1" },
      }),
    });

    const req2 = app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "2",
      },
      body: JSON.stringify({
        section: "identity",
        values: { display_name: "Mutación Pestaña 2" },
      }),
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status].sort();

    // Exactly one must be 200 OK and the other must be 412 Precondition Failed
    expect(statuses).toEqual([200, 412]);

    // Current revision in DB must now be 3
    const finalCheck = await app.request("/api/v1/me/candidate-profile/draft", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(finalCheck.status).toBe(200);
    const finalBody = await finalCheck.json();
    expect(finalBody.data.revision).toBe(3);
  });

  it("isolates drafts across tenants: User B cannot view or mutate User A's draft", async () => {
    // User B has no draft yet
    const resBGet = await app.request("/api/v1/me/candidate-profile/draft", {
      headers: { Authorization: `Bearer ${auth.tokens.b}` },
    });
    expect(resBGet.status).toBe(404);

    // User B attempts to patch
    const resBPatch = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.b}`,
        "Content-Type": "application/json",
        "If-Match": "3",
      },
      body: JSON.stringify({
        section: "identity",
        values: { display_name: "Ataque Cross Tenant" },
      }),
    });
    expect(resBPatch.status).toBe(404);
  });

  it("rejects PATCH experience with invalid dates (end before start) with 400", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "3",
      },
      body: JSON.stringify({
        section: "experience",
        values: {
          items: [
            {
              kind: "FORMAL",
              title: "Asistente",
              description: "Tareas de oficina",
              start_month: "2024-05",
              end_month: "2023-01",
              ongoing: false,
            },
          ],
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("updates experience items and sets status PROVIDED with If-Match 3 -> ETag 4", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "3",
      },
      body: JSON.stringify({
        section: "experience",
        values: {
          items: [
            {
              kind: "INFORMAL",
              title: "Atención al cliente en tienda familiar",
              organization_name: "Tienda San José",
              description: "Atención al público, cobro en caja y despacho de productos.",
              start_month: "2023-02",
              end_month: "2024-01",
              ongoing: false,
            },
            {
              kind: "PERSONAL_PROJECT",
              title: "Sitio web para negocio local",
              description: "Desarrollo de página informativa usando HTML, CSS y JavaScript.",
              ongoing: true,
            },
          ],
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe("4");
    const body = await res.json();
    expect(body.data.revision).toBe(4);
    expect(body.data.experience_status).toBe("PROVIDED");
    expect(body.data.experiences).toHaveLength(2);
    expect(body.data.experiences.some((entry: any) => entry.title === 'Atención al cliente en tienda familiar')).toBe(true);
    expect(body.data.experiences.find((entry: any) => entry.title === 'Sitio web para negocio local').ongoing).toBe(true);
  });

  it("updates experience with status NONE and empty array cleanly", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "4",
      },
      body: JSON.stringify({
        section: "experience",
        values: {
          status: "NONE",
          items: [],
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe("5");
    const body = await res.json();
    expect(body.data.revision).toBe(5);
    expect(body.data.experience_status).toBe("NONE");
    expect(body.data.experiences).toHaveLength(0);
  });

  it("rejects training with future completion date with 400", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "5",
      },
      body: JSON.stringify({
        section: "training",
        values: {
          items: [
            {
              name: "Curso de Ciberseguridad",
              provider_name: "INADEH",
              completed_on: "2099-12-31",
            },
          ],
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("updates training and interests successfully -> ETag 7", async () => {
    // Training update
    const resTraining = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "5",
      },
      body: JSON.stringify({
        section: "training",
        values: {
          items: [
            {
              name: "Fundamentos de Programación Web",
              provider_name: "UTP FISC",
              completed_on: "2024-06-15",
            },
          ],
        },
      }),
    });

    expect(resTraining.status).toBe(200);
    expect(resTraining.headers.get("etag")).toBe("6");
    const bodyTraining = await resTraining.json();
    expect(bodyTraining.data.training_status).toBe("PROVIDED");
    expect(bodyTraining.data.trainings).toHaveLength(1);

    // Interests update
    const resInterests = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "6",
      },
      body: JSON.stringify({
        section: "interests",
        values: {
          items: [
            {
              original_text: "Desarrollador Web Junior",
            },
            {
              original_text: "Soporte Técnico de TI",
            },
          ],
        },
      }),
    });

    expect(resInterests.status).toBe(200);
    expect(resInterests.headers.get("etag")).toBe("7");
    const bodyInterests = await resInterests.json();
    expect(bodyInterests.data.interests_status).toBe("PROVIDED");
    expect(bodyInterests.data.interests).toHaveLength(2);
  });

  it("registers section review with Idempotency-Key and If-Match", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft/section-reviews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "review-section-exp-001",
        "If-Match": "7",
      },
      body: JSON.stringify({
        section: "EXPERIENCE",
        decision: "REVIEWED",
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe("7");
    const body = await res.json();
    expect(body.data.section).toBe("EXPERIENCE");
    expect(body.data.decision).toBe("REVIEWED");
  });

  it("rejects overlapping availability windows on the same day with 400", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "7",
      },
      body: JSON.stringify({
        section: "availability",
        values: {
          windows: [
            {
              weekday: 1,
              start_minute: 480, // 08:00
              end_minute: 720,   // 12:00
              valid_from: "2026-01-01",
              valid_to: "2026-12-31",
            },
            {
              weekday: 1,
              start_minute: 600, // 10:00 (overlaps with 08:00-12:00)
              end_minute: 840,   // 14:00
              valid_from: "2026-01-01",
              valid_to: "2026-12-31",
            },
          ],
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("saves valid availability windows with If-Match 7 -> increments revision to 8 with ETag 8", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "7",
      },
      body: JSON.stringify({
        section: "availability",
        values: {
          windows: [
            {
              weekday: 1,
              start_minute: 480,
              end_minute: 1020,
              valid_from: "2026-01-01",
              valid_to: "2026-12-31",
            },
            {
              weekday: 2,
              start_minute: 480,
              end_minute: 1020,
              valid_from: "2026-01-01",
              valid_to: "2026-12-31",
            },
          ],
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe("8");
    const body = await res.json();
    expect(body.data.revision).toBe(8);
    expect(body.data.windows).toHaveLength(2);
    expect(body.data.windows[0].weekday).toBe(1);
    expect(body.data.windows[0].start_minute).toBe(480);
    expect(body.data.windows[0].end_minute).toBe(1020);
  });

  it("rejects constraints with negative travel minutes with 400", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "8",
      },
      body: JSON.stringify({
        section: "constraints",
        values: {
          travel_limit_state: "KNOWN",
          max_one_way_minutes: -10,
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("saves constraints with max_one_way_minutes: 0 and verifies 0 is strictly distinct from unknown", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "8",
      },
      body: JSON.stringify({
        section: "constraints",
        values: {
          location_state: "KNOWN",
          approximate_zone: "Panamá Centro",
          travel_limit_state: "KNOWN",
          max_one_way_minutes: 0, // Telework only / zero commute
          mobility_state: "KNOWN",
          mobility_modes: ["WALKING"],
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe("9");
    const body = await res.json();
    expect(body.data.revision).toBe(9);
    expect(body.data.constraints).toBeDefined();
    expect(body.data.constraints.travel_limit_state).toBe("KNOWN");
    expect(body.data.constraints.max_one_way_minutes).toBe(0);
    expect(body.data.constraints.approximate_zone).toBe("Panamá Centro");
    expect(body.data.constraints.mobility_modes).toEqual(["WALKING"]);
  });

  it("saves salary, transport and training budgets cleanly with If-Match 9 -> ETag 10", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "9",
      },
      body: JSON.stringify({
        section: "constraints",
        values: {
          location_state: "KNOWN",
          approximate_zone: "San Miguelito",
          mobility_state: "KNOWN",
          mobility_modes: ["BUS", "METRO"],
          travel_limit_state: "KNOWN",
          max_one_way_minutes: 45,
          salary_state: "KNOWN",
          minimum_salary: "650.00",
          salary_currency: "USD",
          salary_period: "MONTH",
          transport_state: "KNOWN",
          transport_budget: "50.00",
          transport_currency: "USD",
          transport_period: "MONTH",
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe("10");
    const body = await res.json();
    expect(body.data.revision).toBe(10);
    expect(body.data.constraints.minimum_salary).toBe("650.00");
    expect(body.data.constraints.salary_period).toBe("MONTH");
    expect(body.data.constraints.transport_budget).toBe("50.00");
    expect(body.data.constraints.max_one_way_minutes).toBe(45);
  });

  let savedPreviewId = "";
  let savedSnapshotDigest = "";
  let savedVersionId = "";
  let savedReceiptId = "";

  it("rejects POST review-previews without If-Match or Idempotency-Key with 428 and 400", async () => {
    const resNoMatch = await app.request("/api/v1/me/candidate-profile/draft/review-previews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Idempotency-Key": "review-preview-valid-key-01",
      },
    });
    expect(resNoMatch.status).toBe(428);

    const resNoKey = await app.request("/api/v1/me/candidate-profile/draft/review-previews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "If-Match": "10",
      },
    });
    expect(resNoKey.status).toBe(400);
  });

  it("generates deterministic review preview with SHA-256 digest and 15-min expiration", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft/review-previews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "If-Match": "10",
        "Idempotency-Key": "review-preview-valid-key-01",
      },
    });

    expect(res.status).toBe(201);
    expect(res.headers.get("etag")).toBe("10");
    const body = await res.json();
    savedPreviewId = body.data.preview_id;
    savedSnapshotDigest = body.data.snapshot_digest;

    expect(body.data.preview_id).toBeDefined();
    expect(body.data.draft_revision).toBe(10);
    expect(body.data.snapshot_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.expires_at).toBeDefined();
    expect(body.data.summary.minimum_salary).toBe("650.00");
    expect(body.data.summary.availability_windows_count).toBe(2);
    expect(body.data.acknowledge_partial_required).toBe(false); // Todas las secciones fueron completadas
  });

  it("replays POST review-previews with same Idempotency-Key returning saved receipt", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft/review-previews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "If-Match": "10",
        "Idempotency-Key": "review-preview-valid-key-01",
      },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.preview_id).toBe(savedPreviewId);
    expect(body.data.snapshot_digest).toBe(savedSnapshotDigest);
  });

  it("rejects POST review-previews with same Idempotency-Key but different If-Match with 409", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft/review-previews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "If-Match": "99",
        "Idempotency-Key": "review-preview-valid-key-01",
      },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("rejects confirmation when draft_id does not exist with 404", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/confirmations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "10",
        "Idempotency-Key": "confirm-profile-valid-key-01",
      },
      body: JSON.stringify({
        draft_id: "00000000-0000-0000-0000-000000000000",
        preview_id: savedPreviewId,
        acknowledge_partial: false,
      }),
    });

    expect(res.status).toBe(404);
  });

  it("confirms draft into immutable Version 1 with Idempotency-Key and emits OperationReceipt", async () => {
    // Primero obtener el draft_id
    const draftRes = await app.request("/api/v1/me/candidate-profile/draft", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    const draftBody = await draftRes.json();
    const activeDraftId = draftBody.data.id;

    const res = await app.request("/api/v1/me/candidate-profile/confirmations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "10",
        "Idempotency-Key": "confirm-profile-valid-key-01",
      },
      body: JSON.stringify({
        draft_id: activeDraftId,
        preview_id: savedPreviewId,
        acknowledge_partial: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.receipt_id).toBeDefined();
    expect(body.data.confirmation_id).toBeDefined();
    expect(body.data.version_number).toBe(1);
    expect(body.data.version_id).toBe(activeDraftId);
    expect(body.data.snapshot_digest).toBe(savedSnapshotDigest);
    expect(body.data.acknowledged_partial).toBe(true);

    savedVersionId = body.data.version_id;
    savedReceiptId = body.data.receipt_id;
  });

  it("replays POST confirmations with same Idempotency-Key returning saved receipt", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/confirmations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "10",
        "Idempotency-Key": "confirm-profile-valid-key-01",
      },
      body: JSON.stringify({
        draft_id: savedVersionId,
        preview_id: savedPreviewId,
        acknowledge_partial: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.receipt_id).toBe(savedReceiptId);
    expect(body.data.version_number).toBe(1);
  });

  it("rejects POST confirmations with same Idempotency-Key but different payload with 409", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/confirmations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "10",
        "Idempotency-Key": "confirm-profile-valid-key-01",
      },
      body: JSON.stringify({
        draft_id: savedVersionId,
        preview_id: savedPreviewId,
        acknowledge_partial: false, // Payload alterado
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("retrieves confirmed version via GET /versions/:versionId", async () => {
    const res = await app.request(`/api/v1/me/candidate-profile/versions/${savedVersionId}`, {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(savedVersionId);
    expect(body.data.status).toBe("CONFIRMED");
    expect(body.data.version_number).toBe(1);
    expect(body.data.constraints.minimum_salary).toBe("650.00");
  });

  it("retrieves operation receipt via GET /profile-operations/:receiptId", async () => {
    const res = await app.request(`/api/v1/me/profile-operations/${savedReceiptId}`, {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.receipt_id).toBe(savedReceiptId);
    expect(body.data.version_number).toBe(1);
    expect(body.data.snapshot_digest).toBe(savedSnapshotDigest);
  });

  it("returns 404 on GET /draft after confirmation because the draft transitioned to CONFIRMED", async () => {
    const res = await app.request("/api/v1/me/candidate-profile/draft", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });

    expect(res.status).toBe(404);
  });

  it('reads the confirmed profile content without creating a draft and keeps other accounts isolated', async () => {
    const before = (await dbFixture.admin.query('SELECT count(*)::int AS n FROM app."ProfileRevision"')).rows[0].n;
    const response = await app.request('/api/v1/me/candidate-profile', { headers: { Authorization: 'Bearer ' + auth.tokens.a } });
    expect(response.status).toBe(200);
    const profile = (await response.json()).data;
    expect(profile.active_draft).toBeNull();
    expect(profile.current_version.id).toBe(profile.current_version_id);
    expect(profile.current_version.status).toBe('CONFIRMED');
    expect(profile.current_version.experiences).toBeArray();
    expect(profile.current_version.trainings).toBeArray();
    const other = await app.request('/api/v1/me/candidate-profile', { headers: { Authorization: 'Bearer ' + auth.tokens.b } });
    if (other.status === 200) expect((await other.json()).data.current_version_id).not.toBe(profile.current_version_id);
    else expect(other.status).toBe(404);
    const after = (await dbFixture.admin.query('SELECT count(*)::int AS n FROM app."ProfileRevision"')).rows[0].n;
    expect(after).toBe(before);
  });

  it("creates a new draft derived from confirmed version, cloning experiences, trainings and constraints", async () => {
    const key = `clone-draft-${Date.now()}-123456789`;
    const createRes = await app.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ base_version_id: savedVersionId }),
    });

    expect(createRes.status).toBe(201);
    const newDraft = (await createRes.json()).data;
    expect(newDraft.status).toBe("DRAFT");
    expect(newDraft.revision).toBe(1);
    expect(newDraft.base_version_id).toBe(savedVersionId);
    expect(newDraft.display_name).toBe("Mutación Pestaña 1");
    expect(newDraft.headline).toBe("Programadora Junior");
    expect(newDraft.experience_status).toBe("NONE");
    expect(newDraft.experiences.length).toBe(0);
    expect(newDraft.trainings.length).toBeGreaterThan(0);
    expect(newDraft.interests.length).toBeGreaterThan(0);
    expect(newDraft.windows.length).toBeGreaterThan(0);
    expect(newDraft.constraints).not.toBeNull();
    expect(newDraft.constraints.minimum_salary).toBe("650.00");

    // Verify GET /me/candidate-profile now includes both active_draft and current_version
    const profileRes = await app.request("/api/v1/me/candidate-profile", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(profileRes.status).toBe(200);
    const profileBody = (await profileRes.json()).data;
    expect(profileBody.current_version_id).toBe(savedVersionId);
    expect(profileBody.active_draft).not.toBeNull();
    expect(profileBody.active_draft.id).toBe(newDraft.id);
    expect(profileBody.current_version.id).toBe(savedVersionId);

    // Modify the new draft by adding an experience
    const patchRes = await app.request("/api/v1/me/candidate-profile/draft", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "If-Match": "1",
      },
      body: JSON.stringify({
        section: "experience",
        values: {
          items: [
            {
              kind: "FORMAL",
              title: "Desarrollador Full Stack Mid",
              organization_name: "Empresa Innovadora",
              description: "Desarrollo de servicios web y APIs REST.",
              start_month: "2024-01",
              end_month: null,
              ongoing: true,
            },
          ],
        },
      }),
    });
    expect(patchRes.status).toBe(200);
    const updatedDraft = (await patchRes.json()).data;
    expect(updatedDraft.revision).toBe(2);
    expect(updatedDraft.experiences.length).toBe(1);

    // Confirmed version 1 must remain completely unchanged!
    const v1Res = await app.request(`/api/v1/me/candidate-profile/versions/${savedVersionId}`, {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(v1Res.status).toBe(200);
    const v1Body = (await v1Res.json()).data;
    expect(v1Body.experiences.length).toBe(0);
  });
});


