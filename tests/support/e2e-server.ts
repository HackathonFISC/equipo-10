import { setupTestDatabase } from './database-fixture';
import { startAuthFixture } from './auth-fixture';
import { createApp } from '../../apps/api/src/app';
import { IdentityService } from '../../apps/api/src/modules/identity/identity.service';
import { createVerifyToken } from '../../apps/api/src/security/auth';

const fixture = await setupTestDatabase();
const authPort = Number(process.env.TEST_AUTH_PORT || 55438);
const auth = startAuthFixture(authPort);

const config = {
  ...fixture.config,
  supabaseUrl: auth.url,
  allowedOrigins: ['http://127.0.0.1:5175', 'http://localhost:5175'],
};

import { ProfileService } from '../../apps/api/src/modules/profile/profile.service';

const identity = new IdentityService(fixture.db);
const profile = new ProfileService(fixture.db);
const verifyToken = createVerifyToken(config);
const app = createApp({
  identityService: identity,
  profileService: profile,
  verifyToken,
  allowedOrigins: config.allowedOrigins,
});

const userAId = await fixture.db.resolveAuthSubject(auth.users.a.id, true);
const userBId = await fixture.db.resolveAuthSubject(auth.users.b.id, true);
if (!userAId || !userBId) {
  throw new Error('Failed to resolve test users');
}

const now = new Date();
const resOrgA = await fixture.admin.query<{ id: string }>(
  `INSERT INTO app."Organization" ("id", "name", "type", "active", "updatedAt")
   VALUES (gen_random_uuid(), $1, 'COMPANY', true, $2)
   RETURNING "id"`,
  ['Empresa Demo', now]
);
const orgAId = resOrgA.rows[0].id;

await fixture.admin.query(
  `INSERT INTO app."OrganizationMembership" ("id", "userId", "organizationId", "role", "updatedAt")
   VALUES (gen_random_uuid(), $1, $2, 'RECRUITER', $3)`,
  [userAId, orgAId, now]
);

const resOrgRealB = await fixture.admin.query<{ id: string }>(
  `INSERT INTO app."Organization" ("id", "name", "type", "active", "updatedAt")
   VALUES (gen_random_uuid(), $1, 'TRAINING_CENTER', true, $2)
   RETURNING "id"`,
  ['Centro Demo', now]
);
const orgBId = resOrgRealB.rows[0].id;

await fixture.admin.query(
  `INSERT INTO app."OrganizationMembership" ("id", "userId", "organizationId", "role", "updatedAt")
   VALUES (gen_random_uuid(), $1, $2, 'TRAINING_MANAGER', $3)`,
  [userBId, orgBId, now]
);

const server = Bun.serve({
  port: 55437,
  hostname: '127.0.0.1',
  fetch: app.fetch,
});

const shutdown = async () => {
  server.stop(true);
  auth.stop();
  await fixture.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
