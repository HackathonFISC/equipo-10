import { Hono } from "hono";
import type { AppEnv } from "../../app";
import { AppError } from "../../errors";
import { PlanningService } from "./planning.service";
import {
  IdSchema,
  LearningPlanPreviewRequestSchema,
} from "@equipo10/contracts";
import { z } from "zod";

const ExplanationBodySchema = z.object({
  consent: z.boolean(),
  answers: z.array(z.object({ field: z.string(), text: z.string() })).optional(),
});

export function createPlanningController(service: PlanningService): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  // POST /me/learning-plans/preview
  router.post("/me/learning-plans/preview", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = LearningPlanPreviewRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const result = await service.previewPlan(identity, parsed.data);
    return c.json({ data: result, request_id: requestId }, 201);
  });

  // POST /me/learning-plans/:id/confirmations
  router.post("/me/learning-plans/:id/confirmations", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const id = c.req.param("id");
    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de plan no válido");
    }

    const result = await service.confirmPlan(identity, idParsed.data);
    return c.json({ data: result, request_id: requestId }, 200);
  });

  // POST /me/learning-plans/:id/explanations
  router.post("/me/learning-plans/:id/explanations", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const id = c.req.param("id");
    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de plan no válido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      rawBody = {};
    }

    const parsed = ExplanationBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const result = await service.explainPlan(
      identity,
      idParsed.data,
      parsed.data.consent,
      parsed.data.answers
    );
    return c.json({ data: result, request_id: requestId }, 201);
  });

  // GET /me/learning-plans
  router.get("/me/learning-plans", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const result = await service.listPlans(identity);
    return c.json({ data: result, request_id: requestId }, 200);
  });

  // GET /me/learning-plans/:id
  router.get("/me/learning-plans/:id", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const id = c.req.param("id");
    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de plan no válido");
    }

    const result = await service.getPlanDetail(identity, idParsed.data);
    return c.json({ data: result, request_id: requestId }, 200);
  });

  return router;
}
