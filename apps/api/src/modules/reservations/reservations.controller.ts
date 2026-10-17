import { Hono } from "hono";
import type { AppEnv } from "../../app";
import { AppError } from "../../errors";
import { ReservationsService } from "./reservations.service";
import {
  IdSchema,
  CourseReservationRequestSchema,
  CourseReservationCancellationRequestSchema,
} from "@equipo10/contracts";

export function createReservationsController(service: ReservationsService): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  // POST /me/course-reservations
  router.post("/me/course-reservations", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = CourseReservationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const { reservation, isReplay } = await service.createReservation(identity, parsed.data, idempotencyKey);
    return c.json({ data: reservation, request_id: requestId }, isReplay ? 200 : 201);
  });

  // GET /me/course-reservations
  router.get("/me/course-reservations", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const items = await service.listReservations(identity);
    return c.json({ data: { items }, request_id: requestId });
  });

  // GET /me/course-reservations/:id
  router.get("/me/course-reservations/:id", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const id = c.req.param("id");

    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "ID de reserva inválido");
    }

    const reservation = await service.getReservationById(identity, id);
    return c.json({ data: reservation, request_id: requestId });
  });

  // POST /me/course-reservations/:id/cancellations
  router.post("/me/course-reservations/:id/cancellations", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const id = c.req.param("id");
    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();

    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "ID de reserva inválido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = CourseReservationCancellationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const updated = await service.cancelReservation(identity, id, parsed.data, idempotencyKey);
    return c.json({ data: updated, request_id: requestId });
  });

  // GET /me/course-reservation-operations/:key
  router.get("/me/course-reservation-operations/:key", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const key = c.req.param("key");

    if (!key || key.length < 1 || key.length > 128) {
      throw new AppError(400, "INVALID_REQUEST", "Clave de operación inválida");
    }

    const receipt = await service.getOperationReceipt(identity, key);
    return c.json({ data: receipt, request_id: requestId });
  });

  // GET /me/agenda
  router.get("/me/agenda", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const agenda = await service.getAgenda(identity);
    return c.json({ data: agenda, request_id: requestId });
  });

  return router;
}
