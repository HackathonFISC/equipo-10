import { Hono } from "hono";
import type { Context } from "hono";
import { IdSchema, EmptyBodySchema } from "@equipo10/contracts";
import { AppError } from "../../errors";
import type { IdentityService } from "./identity.service";
import type { ProfileService } from '../profile/profile.service';
import type { AppEnv } from "../../app";

export function createIdentityController(service: IdentityService, profileReader?: Pick<ProfileService, 'getProfile'>): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/me", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const data = await service.getMe(identity);
    return c.json({ data, request_id: requestId }, 200);
  });

  const parseEmptyJsonBody = async (c: Context<AppEnv>) => {
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de contenido no admitido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = EmptyBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "El cuerpo debe ser un objeto vacío");
    }
  };

  router.put("/me", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    await parseEmptyJsonBody(c);
    const data = await service.bootstrap(identity);
    return c.json({ data, request_id: requestId }, 200);
  });

  router.put("/me/candidate-profile", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    await parseEmptyJsonBody(c);
    const data = await service.ensureProfile(identity);
    return c.json({ data, request_id: requestId }, 200);
  });

  router.get("/me/candidate-profile", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const data = profileReader ? await profileReader.getProfile(identity) : await service.getProfile(identity);
    return c.json({ data, request_id: requestId }, 200);
  });

  router.get("/organizations/:id/context", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const orgId = c.req.param("id");

    const idParsed = IdSchema.safeParse(orgId);
    if (!idParsed.success) {
      throw new AppError(404, "NOT_FOUND", "Organización no encontrada o membresía inactiva");
    }

    const data = await service.organizationContext(identity, idParsed.data);
    return c.json({ data, request_id: requestId }, 200);
  });

  return router;
}
