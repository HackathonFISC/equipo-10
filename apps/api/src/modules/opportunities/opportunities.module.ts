import type { Hono } from "hono";
import type { AppEnv } from "../../app";
import { OpportunitiesService } from "./opportunities.service";
import { createOpportunitiesController } from "./opportunities.controller";

export function createOpportunitiesModule(service: OpportunitiesService): Hono<AppEnv> {
  return createOpportunitiesController(service);
}
