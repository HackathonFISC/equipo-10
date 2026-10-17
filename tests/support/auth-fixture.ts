import { createHmac, timingSafeEqual } from "node:crypto";

export interface SyntheticUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  email_confirmed_at?: string;
  created_at: string;
  app_metadata: { provider: string; providers: string[] };
  user_metadata: Record<string, unknown>;
  identities: unknown[];
}

export interface AuthFixture {
  server: ReturnType<typeof Bun.serve>;
  url: string;
  users: {
    a: SyntheticUser;
    b: SyntheticUser;
    unverified: SyntheticUser;
  };
  tokens: {
    a: string;
    b: string;
    expired: string;
    forged: string;
    unverified: string;
  };
  setUnavailable: (v: boolean) => void;
  stop: () => void;
}

const SECRET = "fixture-test-secret-32-chars-long-d1";
const FORGED_SECRET = "wrong-fixture-secret-not-matching";

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf.toString("base64url");
}

function signJwt(payload: Record<string, unknown>, secret = SECRET): string {
  const header = { alg: "HS256", typ: "JWT" };
  const hB64 = b64url(JSON.stringify(header));
  const pB64 = b64url(JSON.stringify(payload));
  const message = `${hB64}.${pB64}`;
  const sig = createHmac("sha256", secret).update(message).digest();
  return `${message}.${b64url(sig)}`;
}

function verifyJwt(token: string, secret = SECRET): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [hB64, pB64, sB64] = parts;
  const message = `${hB64}.${pB64}`;
  const sig = createHmac("sha256", secret).update(message).digest();
  const incomingSig = Buffer.from(sB64, "base64url");
  if (sig.length !== incomingSig.length || !timingSafeEqual(sig, incomingSig)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(pB64, "base64url").toString("utf-8"));
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < nowSec) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function startAuthFixture(port = 0): AuthFixture {
  let unavailable = false;

  const userA: SyntheticUser = {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: "ana.demo@example.test",
    email_confirmed_at: "2025-01-01T00:00:00Z",
    created_at: "2025-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
  };

  const userB: SyntheticUser = {
    id: "22222222-2222-4222-8222-222222222222",
    aud: "authenticated",
    role: "authenticated",
    email: "bruno.demo@example.test",
    email_confirmed_at: "2025-01-01T00:00:00Z",
    created_at: "2025-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
  };

  const userUnverified: SyntheticUser = {
    id: "33333333-3333-4333-8333-333333333333",
    aud: "authenticated",
    role: "authenticated",
    email: "unverified.demo@example.test",
    created_at: "2025-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
  };

  const now = Math.floor(Date.now() / 1000);

  const makePayload = (sub: string, email: string, exp = now + 3600) => ({
    iss: "http://127.0.0.1/auth/v1",
    aud: "authenticated",
    sub,
    email,
    exp,
    iat: now,
    session_id: "test-session-id",
  });

  const tokenA = signJwt(makePayload(userA.id, userA.email));
  const tokenB = signJwt(makePayload(userB.id, userB.email));
  const tokenExpired = signJwt(makePayload(userA.id, userA.email, now - 3600));
  const tokenForged = signJwt(makePayload(userA.id, userA.email), FORGED_SECRET);
  const tokenUnverified = signJwt(makePayload(userUnverified.id, userUnverified.email));

  const userMap = new Map<string, SyntheticUser>([
    [userA.id, userA],
    [userB.id, userB],
    [userUnverified.id, userUnverified],
  ]);

  const server = Bun.serve({
    port,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      const origin = req.headers.get("origin");
      const allowedOrigins = ["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5175", "http://localhost:5175"];

      const headers = new Headers();
      if (origin && allowedOrigins.includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, apikey, x-client-info, x-supabase-api-version");
        headers.set("Vary", "Origin");
      }

      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }

      if (unavailable) {
        return new Response(JSON.stringify({ code: 503, msg: "Auth service temporarily unavailable" }), {
          status: 503,
          headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET" && url.pathname === "/auth/v1/user") {
        const auth = req.headers.get("authorization");
        if (!auth || !auth.startsWith("Bearer ")) {
          return new Response(JSON.stringify({ code: 401, error_code: "bad_jwt", msg: "Invalid JWT" }), {
            status: 401,
            headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
          });
        }
        const token = auth.substring(7);
        const verified = verifyJwt(token);
        if (!verified || typeof verified.sub !== "string") {
          return new Response(JSON.stringify({ code: 401, error_code: "bad_jwt", msg: "Invalid JWT" }), {
            status: 401,
            headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
          });
        }
        const u = userMap.get(verified.sub);
        if (!u) {
          return new Response(JSON.stringify({ code: 401, error_code: "bad_jwt", msg: "Invalid JWT" }), {
            status: 401,
            headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(u), {
          status: 200,
          headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
        });
      }

      if (req.method === "POST" && url.pathname === "/auth/v1/token") {
        const grantType = url.searchParams.get("grant_type");
        let body: Record<string, unknown> = {};
        try {
          body = await req.json();
        } catch {}

        if (grantType === "password") {
          const email = body.email;
          const password = body.password;
          let matchedUser: SyntheticUser | undefined;
          if (email === userA.email && password === "Demo-test-1234") matchedUser = userA;
          else if (email === userB.email && password === "Demo-test-1234") matchedUser = userB;

          if (!matchedUser) {
            return new Response(JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }), {
              status: 400,
              headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
            });
          }

          const token = signJwt(makePayload(matchedUser.id, matchedUser.email));
          return new Response(
            JSON.stringify({
              access_token: token,
              token_type: "bearer",
              expires_in: 3600,
              refresh_token: `test-refresh-${matchedUser.id}`,
              user: matchedUser,
            }),
            { status: 200, headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" } }
          );
        }

        if (grantType === "refresh_token") {
          const rt = body.refresh_token as string;
          let matchedUser: SyntheticUser | undefined;
          if (rt === `test-refresh-${userA.id}`) matchedUser = userA;
          else if (rt === `test-refresh-${userB.id}`) matchedUser = userB;

          if (!matchedUser) {
            return new Response(JSON.stringify({ error: "invalid_grant", error_description: "Invalid refresh token" }), {
              status: 400,
              headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
            });
          }
          const token = signJwt(makePayload(matchedUser.id, matchedUser.email));
          return new Response(
            JSON.stringify({
              access_token: token,
              token_type: "bearer",
              expires_in: 3600,
              refresh_token: `test-refresh-${matchedUser.id}`,
              user: matchedUser,
            }),
            { status: 200, headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" } }
          );
        }
      }

      if (req.method === "POST" && url.pathname === "/auth/v1/logout") {
        return new Response(null, { status: 204, headers });
      }

      if (req.method === "POST" && url.pathname === "/auth/v1/signup") {
        return new Response(JSON.stringify(userUnverified), {
          status: 200,
          headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
        });
      }

      if (req.method === "POST" && url.pathname === "/auth/v1/recover") {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
        });
      }

      if (req.method === "PUT" && url.pathname === "/auth/v1/user") {
        const auth = req.headers.get("authorization");
        if (!auth || !auth.startsWith("Bearer ")) {
          return new Response(JSON.stringify({ code: 401, error_code: "bad_jwt", msg: "Invalid JWT" }), {
            status: 401,
            headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
          });
        }
        const token = auth.substring(7);
        const verified = verifyJwt(token);
        if (!verified || typeof verified.sub !== "string") {
          return new Response(JSON.stringify({ code: 401, error_code: "bad_jwt", msg: "Invalid JWT" }), {
            status: 401,
            headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
          });
        }
        const u = userMap.get(verified.sub);
        if (!u) {
          return new Response(JSON.stringify({ code: 401, error_code: "bad_jwt", msg: "Invalid JWT" }), {
            status: 401,
            headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(u), {
          status: 200,
          headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ code: 404, msg: "Not found" }), {
        status: 404,
        headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" },
      });
    },
  });

  const url = `http://127.0.0.1:${server.port}`;

  return {
    server,
    url,
    users: { a: userA, b: userB, unverified: userUnverified },
    tokens: { a: tokenA, b: tokenB, expired: tokenExpired, forged: tokenForged, unverified: tokenUnverified },
    setUnavailable: (v: boolean) => {
      unavailable = v;
    },
    stop: () => server.stop(true),
  };
}
