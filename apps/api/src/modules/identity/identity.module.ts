import type { Hono } from "hono";
import type { IdentityDatabase } from "../../infrastructure/database";
import type { AppEnv } from "../../app";
import { IdentityService } from "./identity.service";
import { createIdentityController } from "./identity.controller";

export function createIdentityModule(service: IdentityService): Hono<AppEnv> {
  return createIdentityController(service);
}
