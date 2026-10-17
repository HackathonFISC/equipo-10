import { Hono } from "hono";
import type { AppEnv } from "../../app";
import { AppError } from "../../errors";
import { OpportunitiesService } from "./opportunities.service";
import {
  OpportunitiesQuerySchema,
  IdSchema,
  CreateOpportunityComparisonRequestSchema,
  CreateOpportunityExplanationRequestSchema,
} from "@equipo10/contracts";

export function createOpportunitiesController(service: OpportunitiesService): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/opportunities", async (c) => {
    const identity = c.get("identity");
    const rawQuery = c.req.query();
    const parsed = OpportunitiesQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Parámetros de consulta no válidos", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const result = await service.listOpportunities(identity, parsed.data);
    const requestId = c.get("requestId");
    return c.json({ data: result, request_id: requestId }, 200);
  });

  router.get("/opportunities/:id", async (c) => {
    const identity = c.get("identity");
    const id = c.req.param("id");
    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de oportunidad no válido");
    }

    const result = await service.getOpportunityById(identity, idParsed.data);
    const requestId = c.get("requestId");
    return c.json({ data: result, request_id: requestId }, 200);
  });

  router.get("/me/opportunity-comparisons", async (c) => {
    const identity = c.get("identity");
    const limitQuery = c.req.query("limit");
    const limit = limitQuery ? parseInt(limitQuery, 10) : 10;
    const result = await service.listComparisons(identity, isNaN(limit) ? 10 : limit);
    const requestId = c.get("requestId");
    return c.json({ data: result, request_id: requestId }, 200);
  });

  router.post("/me/opportunity-comparisons", async (c) => {
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

    const parsed = CreateOpportunityComparisonRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const { comparison, created } = await service.createComparison(
      identity,
      parsed.data.opportunity_id,
      parsed.data.assumptions,
      idempotencyKey
    );

    return c.json({ data: comparison, request_id: requestId }, created ? 201 : 200);
  });

  router.get("/me/opportunity-comparisons/:id", async (c) => {
    const identity = c.get("identity");
    const id = c.req.param("id");
    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de comparación no válido");
    }

    const result = await service.getComparisonById(identity, idParsed.data);
    const requestId = c.get("requestId");
    return c.json({ data: result, request_id: requestId }, 200);
  });

  router.post("/me/opportunity-comparisons/:id/explanations", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const id = c.req.param("id");
    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de comparación no válido");
    }

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

    const parsed = CreateOpportunityExplanationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const { explanation, created } = await service.createExplanation(
      identity,
      idParsed.data,
      parsed.data,
      idempotencyKey
    );

    return c.json({ data: explanation, request_id: requestId }, created ? 201 : 200);
  });

  router.get("/me/opportunity-comparisons/:id/explanations", async (c) => {
    const identity = c.get("identity");
    const id = c.req.param("id");
    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de comparación no válido");
    }

    const result = await service.getExplanationByComparisonId(identity, idParsed.data);
    const requestId = c.get("requestId");
    return c.json({ data: result, request_id: requestId }, 200);
  });

  return router;
}
