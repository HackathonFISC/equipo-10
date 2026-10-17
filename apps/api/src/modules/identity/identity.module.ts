import type { Hono } from "hono";
import type { IdentityDatabase } from "../../infrastructure/database";
import type { AppEnv } from "../../app";
import { IdentityService } from "./identity.service";
import { createIdentityController } from "./identity.controller";
import type { ProfileService } from '../profile/profile.service';

export function createIdentityModule(service: IdentityService, profileReader?: Pick<ProfileService, 'getProfile'>): Hono<AppEnv> {
  return createIdentityController(service, profileReader);
}
