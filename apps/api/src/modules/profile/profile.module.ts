import type { Hono } from "hono";
import type { AppEnv } from "../../app";
import { ProfileService } from "./profile.service";
import { createProfileController } from "./profile.controller";

export function createProfileModule(service: ProfileService): Hono<AppEnv> {
  return createProfileController(service);
}
