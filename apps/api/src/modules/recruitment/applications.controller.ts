import { Hono } from "hono";
import type { AppEnv } from "../../app";
import { AppError } from "../../errors";
import type { ApplicationsService } from "./applications.service";
import {
  IdSchema,
  ApplyToOpportunityRequestSchema,
  WithdrawApplicationRequestSchema,
} from "@equipo10/contracts";

export function createApplicationsController(service: ApplicationsService): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  // POST /opportunities/:opportunityId/applications
  router.post("/opportunities/:opportunityId/applications", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const opportunityId = c.req.param("opportunityId");

    const idParsed = IdSchema.safeParse(opportunityId);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "ID de vacante inválido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = ApplyToOpportunityRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const headerKey=c.req.header('Idempotency-Key');
    if(headerKey&&parsed.data.idempotency_key&&headerKey!==parsed.data.idempotency_key)throw new AppError(400,'IDEMPOTENCY_KEY_MISMATCH','La clave del encabezado y cuerpo debe coincidir');
    const application = await service.applyToOpportunity(identity, opportunityId, {...parsed.data,idempotency_key:headerKey??parsed.data.idempotency_key});
    return c.json({ data: application, request_id: requestId }, 201);
  });

  // GET /me/applications
  router.get("/me/applications", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const items = await service.listMyApplications(identity);
    return c.json({ data: { items }, request_id: requestId }, 200);
  });

  // POST /me/applications/:applicationId/withdrawal
  router.post("/me/applications/:applicationId/withdrawal", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const applicationId = c.req.param("applicationId");

    const idParsed = IdSchema.safeParse(applicationId);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "ID de postulación inválido");
    }

    let rawBody: unknown = {};
    try {
      rawBody = await c.req.json();
    } catch {
      // Body can be empty for withdrawal
      rawBody = {};
    }

    const parsed = WithdrawApplicationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const headerKey=c.req.header('Idempotency-Key');
    if(headerKey&&parsed.data.idempotency_key&&headerKey!==parsed.data.idempotency_key)throw new AppError(400,'IDEMPOTENCY_KEY_MISMATCH','La clave del encabezado y cuerpo debe coincidir');
    const application = await service.withdrawApplication(identity, applicationId, {...parsed.data,idempotency_key:headerKey??parsed.data.idempotency_key});
    return c.json({ data: application, request_id: requestId }, 200);
  });

  return router;
}
