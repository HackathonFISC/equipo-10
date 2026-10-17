import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";
import type { Hono } from "hono";
import type { AppEnv } from "../../apps/api/src/app";

describe("D1 Integration Access & Identity", () => {
  let auth: AuthFixture;
  let dbFixture: DatabaseFixture;
  let app: Hono<AppEnv>;
  let userAId: string;
  let userBId: string;
  let companyOrgId: string;
  let trainingOrgId: string;
  let membershipAId: string;

  beforeAll(async () => {
    auth = startAuthFixture(0);
    dbFixture = await setupTestDatabase();

    const verifyToken = createVerifyToken({ ...dbFixture.config, supabaseUrl: auth.url });
    const identityService = new IdentityService(dbFixture.db);

    app = createApp({
      identityService,
      verifyToken,
      allowedOrigins: dbFixture.config.allowedOrigins,
    });
  }, 60000);

  afterAll(async () => {
    if (auth) auth.stop();
    if (dbFixture) await dbFixture.close();
  });

  it("probes health endpoint", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", stage: "D1" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("enforces CORS and headers on foreign origin and known OPTIONS", async () => {
    const foreign = await app.request("/health", {
      headers: { Origin: "http://malicious.origin.test" },
    });
    expect(foreign.status).toBe(403);
    const fBody = await foreign.json();
    expect(fBody.error.code).toBe("ORIGIN_NOT_ALLOWED");

    const preflight = await app.request("/api/v1/me", {
      method: "OPTIONS",
      headers: { Origin: "http://127.0.0.1:5173" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
  });

  it("rejects missing, malformed, expired, forged, and unverified tokens", async () => {
    const noAuth = await app.request("/api/v1/me");
    expect(noAuth.status).toBe(401);
    const noAuthJson = await noAuth.json();
    expect(noAuthJson.error.code).toBe("AUTH_REQUIRED");

    const badFormat = await app.request("/api/v1/me", {
      headers: { Authorization: "NotBearer xyz" },
    });
    expect(badFormat.status).toBe(401);

    const expired = await app.request("/api/v1/me", {
      headers: { Authorization: `Bearer ${auth.tokens.expired}` },
    });
    expect(expired.status).toBe(401);
    expect(JSON.stringify(await expired.json())).not.toContain(auth.tokens.expired);

    const forged = await app.request("/api/v1/me", {
      headers: { Authorization: `Bearer ${auth.tokens.forged}` },
    });
    expect(forged.status).toBe(401);

    const unverified = await app.request("/api/v1/me", {
      headers: { Authorization: `Bearer ${auth.tokens.unverified}` },
    });
    expect(unverified.status).toBe(403);
  });

  it("returns 404 ACCOUNT_NOT_INITIALIZED on GET /me before bootstrap", async () => {
    const res = await app.request("/api/v1/me", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("ACCOUNT_NOT_INITIALIZED");
  });

  it("idempotently bootstraps user A and user B via PUT /me", async () => {
    const resA1 = await app.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resA1.status).toBe(200);
    const dataA1 = (await resA1.json()).data;
    expect(dataA1.email).toBe(auth.users.a.email);
    expect(dataA1.profile).toBeNull();
    expect(dataA1.contexts).toEqual([]);
    userAId = dataA1.user.id;

    const resA2 = await app.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resA2.status).toBe(200);
    const dataA2 = (await resA2.json()).data;
    expect(dataA2.user.id).toBe(userAId);

    const resB = await app.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.b}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resB.status).toBe(200);
    const dataB = (await resB.json()).data;
    expect(dataB.email).toBe(auth.users.b.email);
    userBId = dataB.user.id;
    expect(userBId).not.toBe(userAId);

    const usersCount = await dbFixture.admin.query("SELECT count(*)::int as c FROM app.\"AppUser\";");
    expect(usersCount.rows[0].c).toBe(2);
  });

  it("supports concurrent PUT /me bootstrap idempotency", async () => {
    const results = await Promise.all([
      app.request("/api/v1/me", {
        method: "PUT",
        headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      app.request("/api/v1/me", {
        method: "PUT",
        headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    ]);
    for (const res of results) {
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.user.id).toBe(userAId);
    }
  });

  it("validates PUT /me/candidate-profile request bodies and creates profile", async () => {
    const nonJson = await app.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "text/plain" },
      body: "not json",
    });
    expect(nonJson.status).toBe(415);

    const malformed = await app.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: "{ invalid json",
    });
    expect(malformed.status).toBe(400);

    const injection = await app.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "ADMIN", ownerUserId: "00000000-0000-0000-0000-000000000000" }),
    });
    expect(injection.status).toBe(400);

    const oversizePayload = JSON.stringify({ dummy: "x".repeat(64 * 1024) });
    const oversize = await app.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: oversizePayload,
    });
    expect(oversize.status).toBe(413);

    const create1 = await app.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(create1.status).toBe(200);
    const prof1 = (await create1.json()).data;
    expect(prof1.id).toBeTruthy();
    expect(prof1.current_version_id).toBeNull();

    const create2 = await app.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(create2.status).toBe(200);
    const prof2 = (await create2.json()).data;
    expect(prof2.id).toBe(prof1.id);

    const profRes = await app.request("/api/v1/me/candidate-profile", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(profRes.status).toBe(200);
    expect((await profRes.json()).data.id).toBe(prof1.id);

    const profBRes = await app.request("/api/v1/me/candidate-profile", {
      headers: { Authorization: `Bearer ${auth.tokens.b}` },
    });
    expect(profBRes.status).toBe(404);

    const pCount = await dbFixture.admin.query("SELECT count(*)::int as c FROM app.\"CandidateProfile\";");
    expect(pCount.rows[0].c).toBe(1);
  });

  it("seeds organizations/memberships and tests context isolation and deactivation", async () => {
    const now = new Date().toISOString();
    const orgA = await dbFixture.admin.query(
      `INSERT INTO app."Organization" ("id", "name", "type", "active", "updatedAt")
       VALUES (gen_random_uuid(), 'Alpha Corp', 'COMPANY', true, $1)
       RETURNING "id";`,
      [now]
    );
    companyOrgId = orgA.rows[0].id;

    const orgB = await dbFixture.admin.query(
      `INSERT INTO app."Organization" ("id", "name", "type", "active", "updatedAt")
       VALUES (gen_random_uuid(), 'Beta Academy', 'TRAINING_CENTER', true, $1)
       RETURNING "id";`,
      [now]
    );
    trainingOrgId = orgB.rows[0].id;

    const memA = await dbFixture.admin.query(
      `INSERT INTO app."OrganizationMembership" ("id", "organizationId", "userId", "role", "status", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'RECRUITER', 'ACTIVE', $3)
       RETURNING "id";`,
      [companyOrgId, userAId, now]
    );
    membershipAId = memA.rows[0].id;

    await dbFixture.admin.query(
      `INSERT INTO app."OrganizationMembership" ("id", "organizationId", "userId", "role", "status", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'TRAINING_MANAGER', 'ACTIVE', $3);`,
      [trainingOrgId, userBId, now]
    );

    const getMeA = await app.request("/api/v1/me", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(getMeA.status).toBe(200);
    const meDataA = (await getMeA.json()).data;
    expect(meDataA.contexts).toHaveLength(1);
    expect(meDataA.contexts[0].organization.id).toBe(companyOrgId);
    expect(meDataA.contexts[0].role).toBe("RECRUITER");

    const getMeB = await app.request("/api/v1/me", {
      headers: { Authorization: `Bearer ${auth.tokens.b}` },
    });
    expect(getMeB.status).toBe(200);
    const meDataB = (await getMeB.json()).data;
    expect(meDataB.contexts).toHaveLength(1);
    expect(meDataB.contexts[0].organization.id).toBe(trainingOrgId);
    expect(meDataB.contexts[0].role).toBe("TRAINING_MANAGER");

    const ownCtx = await app.request(`/api/v1/organizations/${companyOrgId}/context`, {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(ownCtx.status).toBe(200);
    const ownCtxData = (await ownCtx.json()).data;
    expect(ownCtxData.organization.id).toBe(companyOrgId);

    const foreignCtx = await app.request(`/api/v1/organizations/${trainingOrgId}/context`, {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(foreignCtx.status).toBe(404);
    const foreignBody = await foreignCtx.json();

    const unknownOrgId = "00000000-0000-0000-0000-000000000000";
    const nonExistentCtx = await app.request(`/api/v1/organizations/${unknownOrgId}/context`, {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(nonExistentCtx.status).toBe(404);
    const nonExistentBody = await nonExistentCtx.json();
    expect(foreignBody.error.code).toBe(nonExistentBody.error.code);
    expect(foreignBody.error.message).toBe(nonExistentBody.error.message);

    await dbFixture.admin.query(
      `UPDATE app."Organization" SET "active" = false WHERE "id" = $1;`,
      [trainingOrgId]
    );
    const getMeBInactive = await app.request("/api/v1/me", {
      headers: { Authorization: `Bearer ${auth.tokens.b}` },
    });
    expect((await getMeBInactive.json()).data.contexts).toHaveLength(0);
    const ownBInactiveCtx = await app.request(`/api/v1/organizations/${trainingOrgId}/context`, {
      headers: { Authorization: `Bearer ${auth.tokens.b}` },
    });
    expect(ownBInactiveCtx.status).toBe(404);
    await dbFixture.admin.query(
      `UPDATE app."Organization" SET "active" = true WHERE "id" = $1;`,
      [trainingOrgId]
    );

    await dbFixture.admin.query(
      `UPDATE app."OrganizationMembership" SET "status" = 'REVOKED' WHERE "id" = $1;`,
      [membershipAId]
    );
    const revokedMe = await app.request("/api/v1/me", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect((await revokedMe.json()).data.contexts).toHaveLength(0);

    const revokedCtx = await app.request(`/api/v1/organizations/${companyOrgId}/context`, {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(revokedCtx.status).toBe(404);
  });

  it("isolates actor contexts across 12 concurrent requests", async () => {
    const tasks = Array.from({ length: 12 }, async (_, i) => {
      const isUserA = i % 2 === 0;
      const token = isUserA ? auth.tokens.a : auth.tokens.b;
      const expectedEmail = isUserA ? auth.users.a.email : auth.users.b.email;
      const res = await app.request("/api/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.email).toBe(expectedEmail);
    });
    await Promise.all(tasks);
  });

  it("denies access if AppUser is disabled and handles Auth 503", async () => {
    await dbFixture.admin.query(`UPDATE app."AppUser" SET "status" = 'DISABLED' WHERE "id" = $1;`, [userBId]);
    const disabledRes = await app.request("/api/v1/me", {
      headers: { Authorization: `Bearer ${auth.tokens.b}` },
    });
    expect(disabledRes.status).toBe(403);

    const disabledPutRes = await app.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.b}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(disabledPutRes.status).toBe(403);

    const userBStatus = await dbFixture.admin.query(`SELECT "status" FROM app."AppUser" WHERE "id" = $1;`, [userBId]);
    expect(userBStatus.rows[0].status).toBe("DISABLED");

    auth.setUnavailable(true);
    const unavailRes = await app.request("/api/v1/me", {
      headers: { Authorization: `Bearer ${auth.tokens.a}` },
    });
    expect(unavailRes.status).toBe(503);
    auth.setUnavailable(false);
  });
});
