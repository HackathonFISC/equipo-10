import { Hono } from "hono";
import type { AppEnv } from "../../app";
import { AppError } from "../../errors";
import { OrientationService } from "./orientation.service";
import {
  IdSchema,
  CreateOrientationEngagementRequestSchema,
  RevokeOrientationEngagementRequestSchema,
  CreateClarificationRequestSchema,
  RespondClarificationRequestSchema,
  CreateOrientationReviewRequestSchema,
} from "@equipo10/contracts";

export function createOrientationController(service: OrientationService): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  // 1. GET /counselors - Listar orientadores habilitados
  router.get("/counselors", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const counselors = await service.listAvailableCounselors(identity);
    return c.json({ data: counselors, request_id: requestId }, 200);
  });

  // 2. POST /me/learning-plans/:planId/engagements - Joven solicita acompañamiento
  router.post("/me/learning-plans/:planId/engagements", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const planId = c.req.param("planId");

    const planIdParsed = IdSchema.safeParse(planId);
    if (!planIdParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de plan no válido");
    }

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8) {
      throw new AppError(400, "INVALID_REQUEST", "Encabezado Idempotency-Key requerido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = CreateOrientationEngagementRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const { engagement, isReplay } = await service.requestOrientation(
      identity,
      planIdParsed.data,
      parsed.data,
      idempotencyKey
    );

    return c.json({ data: engagement, request_id: requestId }, isReplay ? 200 : 201);
  });

  // 3. GET /me/learning-plans/:planId/engagements - Joven consulta acompañamientos de su plan
  router.get("/me/learning-plans/:planId/engagements", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const planId = c.req.param("planId");

    const planIdParsed = IdSchema.safeParse(planId);
    if (!planIdParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de plan no válido");
    }

    const engagements = await service.listCandidateEngagements(identity, planIdParsed.data);
    return c.json({ data: engagements, request_id: requestId }, 200);
  });

  // 4. POST /me/orientations/:engagementId/revoke - Joven revoca el acompañamiento
  router.post("/me/orientations/:engagementId/revoke", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const engagementId = c.req.param("engagementId");

    const engagementIdParsed = IdSchema.safeParse(engagementId);
    if (!engagementIdParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de acompañamiento no válido");
    }

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();

    let rawBody: unknown = {};
    try {
      rawBody = await c.req.json();
    } catch {
      rawBody = {};
    }

    const parsed = RevokeOrientationEngagementRequestSchema.safeParse(rawBody);
    const result = await service.revokeOrientation(
      identity,
      engagementIdParsed.data,
      parsed.success ? parsed.data : {},
      idempotencyKey
    );

    return c.json({ data: result, request_id: requestId }, 200);
  });

  // 5. POST /me/orientations/:engagementId/clarifications/:clarificationId/respond - Joven responde a aclaración
  router.post("/me/orientations/:engagementId/clarifications/:clarificationId/respond", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const engagementId = c.req.param("engagementId");
    const clarificationId = c.req.param("clarificationId");

    const engagementIdParsed = IdSchema.safeParse(engagementId);
    const clarificationIdParsed = IdSchema.safeParse(clarificationId);
    if (!engagementIdParsed.success || !clarificationIdParsed.success) {
      throw new AppError(400, "INVALID_ID", "Parámetros de identificación no válidos");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo JSON inválido");
    }

    const parsed = RespondClarificationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const result = await service.respondClarification(
      identity,
      engagementIdParsed.data,
      clarificationIdParsed.data,
      parsed.data
    );

    return c.json({ data: result, request_id: requestId }, 200);
  });

  // 6. GET /counselor/engagements - Bandeja del orientador
  router.get("/counselor/engagements", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const items = await service.listCounselorInbox(identity);
    return c.json({ data: items, request_id: requestId }, 200);
  });

  // 7. GET /counselor/engagements/:id - Detalle autorizado para el orientador
  router.get("/counselor/engagements/:id", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const id = c.req.param("id");

    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de solicitud no válido");
    }

    const detail = await service.getCounselorEngagementDetail(identity, idParsed.data);
    return c.json({ data: detail, request_id: requestId }, 200);
  });

  // 8. POST /counselor/engagements/:id/clarifications - Orientador solicita aclaración
  router.post("/counselor/engagements/:id/clarifications", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const id = c.req.param("id");

    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de solicitud no válido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo JSON inválido");
    }

    const parsed = CreateClarificationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const result = await service.createClarification(identity, idParsed.data, parsed.data);
    return c.json({ data: result, request_id: requestId }, 201);
  });

  // 9. POST /counselor/engagements/:id/review - Orientador emite revisión motivada
  router.post("/counselor/engagements/:id/review", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const id = c.req.param("id");

    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de solicitud no válido");
    }

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo JSON inválido");
    }

    const parsed = CreateOrientationReviewRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const { review } = await service.submitReview(
      identity,
      idParsed.data,
      parsed.data,
      idempotencyKey
    );
    return c.json({ data: review, request_id: requestId }, 200);
  });

  return router;
}
