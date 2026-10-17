import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { randomUUID } from "node:crypto";
import { AppError } from "./errors";
import type { VerifiedIdentity, VerifyToken } from "./security/auth";
import type { IdentityService } from "./modules/identity/identity.service";
import { createIdentityModule } from "./modules/identity/identity.module";
import type { ProfileService } from "./modules/profile/profile.service";
import { createProfileModule } from "./modules/profile/profile.module";

export interface AppEnv {
  Variables: {
    identity: VerifiedIdentity;
    requestId: string;
  };
}

export interface AppDependencies {
  identityService: IdentityService;
  profileService?: ProfileService;
  verifyToken: VerifyToken;
  allowedOrigins: string[];
}

export function createApp(deps: AppDependencies): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());

  app.use("*", async (c, next) => {
    const requestId = randomUUID();
    c.set("requestId", requestId);
    c.header("Cache-Control", "no-store");
    c.header("X-Request-Id", requestId);

    const origin = c.req.header("Origin");
    if (origin) {
      if (!deps.allowedOrigins.includes(origin)) {
        return c.json(
          new AppError(403, "ORIGIN_NOT_ALLOWED", "Origen no permitido").toPayload(requestId),
          403
        );
      }
      c.header("Vary", "Origin");
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Authorization, Content-Type, If-Match, Idempotency-Key");
      c.header("Access-Control-Expose-Headers", "ETag, X-Request-Id");
    }

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();
  });

  app.use("*", async (c, next) => {
    if (c.req.path.includes("/profile-sources")) {
      return bodyLimit({
        maxSize: 10 * 1024 * 1024,
        onError: (c) => {
          const requestId = c.get("requestId") ?? randomUUID();
          return c.json(
            new AppError(413, "SOURCE_TOO_LARGE", "El archivo supera el límite de 10 MiB").toPayload(requestId),
            413
          );
        },
      })(c, next);
    }
    return bodyLimit({
      maxSize: 4096,
      onError: (c) => {
        const requestId = c.get("requestId") ?? randomUUID();
        return c.json(
          new AppError(413, "PAYLOAD_TOO_LARGE", "El tamaño de la petición excede el límite permitido").toPayload(requestId),
          413
        );
      },
    })(c, next);
  });

  app.get("/health", (c) => {
    return c.json({ status: "ok", stage: "D1" }, 200);
  });

  const api = new Hono<AppEnv>();

  api.use("*", async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      throw new AppError(401, "AUTH_REQUIRED", "Encabezado de autorización ausente");
    }

    if (authHeader.length > 8192) {
      throw new AppError(401, "AUTH_REQUIRED", "Token excede longitud permitida");
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new AppError(401, "AUTH_REQUIRED", "Formato de token no válido");
    }

    const token = parts[1];
    const identity = await deps.verifyToken(token);
    c.set("identity", identity);
    await next();
  });

  const identityModule = createIdentityModule(deps.identityService, deps.profileService);
  api.route("/", identityModule);

  if (deps.profileService) {
    const profileModule = createProfileModule(deps.profileService);
    api.route("/", profileModule);
  }

  app.route("/api/v1", api);

  app.notFound((c) => {
    const requestId = c.get("requestId") ?? randomUUID();
    return c.json(
      new AppError(404, "NOT_FOUND", "Recurso no encontrado").toPayload(requestId),
      404
    );
  });

  app.onError((err, c) => {
    const requestId = c.get("requestId") ?? randomUUID();
    if (
      err instanceof AppError ||
      (typeof err === "object" && err !== null && (err as any).name === "AppError")
    ) {
      const appErr = err as AppError;
      return c.json(appErr.toPayload(requestId), appErr.status as ContentfulStatusCode);
    }
    console.error("Hono unhandled error:", err);
    const fallback = new AppError(503, "SERVICE_UNAVAILABLE", "Servicio no disponible", true);
    return c.json(fallback.toPayload(requestId), 503);
  });

  return app;
}
