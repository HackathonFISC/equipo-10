import { Hono } from "hono";
import type { AppEnv } from "../../app";
import { AppError } from "../../errors";
import { CoursesService } from "./courses.service";
import { IdSchema } from "@equipo10/contracts";
import { z } from "zod";

const CoursesQueryFilterSchema = z.object({
  q: z.string().max(100).optional(),
  competency_id: z.string().uuid().optional(),
  modality: z.enum(["ON_SITE", "REMOTE", "HYBRID"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function createCoursesController(service: CoursesService): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/courses", async (c) => {
    const identity = c.get("identity");
    const rawQuery = c.req.query();
    const parsed = CoursesQueryFilterSchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Parámetros de consulta de cursos no válidos", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const result = await service.listCourses(identity, parsed.data);
    const requestId = c.get("requestId");
    return c.json({ data: result, request_id: requestId }, 200);
  });

  router.get("/courses/:id", async (c) => {
    const identity = c.get("identity");
    const id = c.req.param("id");
    const idParsed = IdSchema.safeParse(id);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_ID", "ID de curso no válido");
    }

    const result = await service.getCourseDetail(identity, idParsed.data);
    const requestId = c.get("requestId");
    return c.json({ data: result, request_id: requestId }, 200);
  });

  return router;
}
