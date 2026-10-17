import type { Hono } from "hono";
import type { AppEnv } from "../../app";
import { CoursesService } from "./courses.service";
import { createCoursesController } from "./courses.controller";

export function createCoursesModule(service: CoursesService): Hono<AppEnv> {
  return createCoursesController(service);
}
