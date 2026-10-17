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
import { OpportunitiesService } from '../../apps/api/src/modules/opportunities/opportunities.service';
import { CoursesService } from '../../apps/api/src/modules/courses/courses.service';
import { AgentA05Service } from '../../apps/api/src/modules/planning/agent-a05.service';
import { PlanningService } from '../../apps/api/src/modules/planning/planning.service';
import { ReservationsService } from '../../apps/api/src/modules/reservations/reservations.service';

const identity = new IdentityService(fixture.db);
const profile = new ProfileService(fixture.db);
const opportunities = new OpportunitiesService(fixture.db);
const courses = new CoursesService(fixture.db);
const agentA05 = new AgentA05Service(fixture.db);
const planning = new PlanningService(fixture.db, agentA05);
const reservations = new ReservationsService(fixture.db);

const verifyToken = createVerifyToken(config);
const app = createApp({
  identityService: identity,
  profileService: profile,
  opportunitiesService: opportunities,
  coursesService: courses,
  planningService: planning,
  reservationsService: reservations,
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

const catVersionId = "c0000000-0000-4000-a000-000000000001";
const occId = "0cc00000-0000-4000-a000-000000000001";
const comp1Id = "c1000000-0000-4000-a000-000000000001";
const comp2Id = "c2000000-0000-4000-a000-000000000002";
const oppId = "e0000000-0000-4000-a000-000000000001";

await fixture.admin.query(`
  INSERT INTO app."CatalogVersion" ("id", "code", "sourceLabel")
  VALUES ('${catVersionId}', 'CAT-PA-2026', 'Catálogo Demo 2026')
  ON CONFLICT DO NOTHING;

  INSERT INTO app."OccupationEntry" ("id", "catalogVersionId", "code", "name", "description", "active")
  VALUES ('${occId}', '${catVersionId}', '9333', 'Auxiliar de bodega', 'Labores de almacén e inventario', true)
  ON CONFLICT DO NOTHING;

  INSERT INTO app."CompetencyEntry" ("id", "catalogVersionId", "code", "name", "description", "kind")
  VALUES
    ('${comp1Id}', '${catVersionId}', 'COMP-INV-01', 'Registro de inventario', 'Registro físico y digital de existencias', 'SKILL'),
    ('${comp2Id}', '${catVersionId}', 'COMP-FORK-01', 'Manejo de transpaleta manual', 'Traslado seguro de mercancía en piso', 'SKILL')
  ON CONFLICT DO NOTHING;

  INSERT INTO app."Opportunity" (
    "id", "organizationId", "title", "description", "occupationId", "catalogVersionId",
    "location", "workplaceType", "salaryAmount", "salaryCurrency", "salaryPeriod",
    "scheduleSummary", "availableSlots", "active", "isDemo", "version", "publishedAt"
  ) VALUES (
    '${oppId}', '${orgAId}', 'Auxiliar de Bodega e Inventario',
    'Responsable del conteo de existencias y estiba de pedidos en sucursal.',
    '${occId}', '${catVersionId}', 'Ciudad de Panamá, Juan Díaz',
    'ON_SITE', 650.00, 'USD', 'MONTH', 'Lunes a Viernes 08:00 - 17:00',
    3, true, true, 1, NOW()
  ) ON CONFLICT DO NOTHING;

  INSERT INTO app."OpportunityRequirement" (
    "id", "opportunityId", "competencyId", "catalogVersionId", "requirementType", "stage", "description"
  ) VALUES
    (gen_random_uuid(), '${oppId}', '${comp1Id}', '${catVersionId}', 'ESSENTIAL', 'ENTRY', 'Conteo y registro físico de existencias'),
    (gen_random_uuid(), '${oppId}', '${comp2Id}', '${catVersionId}', 'DESIRABLE', 'TRAINABLE', 'Operación de transpaleta')
  ON CONFLICT DO NOTHING;

  INSERT INTO app."Course" ("id", "organizationId", "code", "title", "description", "active", "isDemo", "updatedAt")
  VALUES ('c0000000-0000-4000-b000-000000000001', '${orgBId}', 'CUR-INV-DEMO', 'Gestión de Inventarios y Almacén', 'Curso intensivo de logística', true, true, NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO app."CourseVersion" ("id", "courseId", "catalogVersionId", "versionNumber", "syllabusText", "durationHours")
  VALUES ('ba000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-b000-000000000001', '${catVersionId}', 1, 'Módulo 1: Control de stock', 40)
  ON CONFLICT DO NOTHING;

  INSERT INTO app."CourseLearningOutcome" ("id", "courseVersionId", "competencyId", "catalogVersionId", "description")
  VALUES ('d0000000-0000-4000-b000-000000000001', 'ba000000-0000-4000-b000-000000000001', '${comp1Id}', '${catVersionId}', 'Dominio de inventario')
  ON CONFLICT DO NOTHING;

  INSERT INTO app."CourseEdition" ("id", "courseVersionId", "modality", "location", "startDate", "endDate", "totalSlots", "availableSlots", "costAmount", "costCurrency", "costPeriod", "scheduleSummary", "active", "isDemo", "version", "updatedAt")
  VALUES ('ea000000-0000-4000-b000-000000000001', 'ba000000-0000-4000-b000-000000000001', 'ON_SITE', 'Sede Central', CURRENT_DATE + 5, CURRENT_DATE + 30, 10, 10, 25.00, 'USD', 'TOTAL', 'Sábados 08:00 - 12:00', true, true, 1, NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO app."CourseSession" ("id", "editionId", "weekday", "startMinute", "endMinute", "timezone", "location")
  VALUES ('fa000000-0000-4000-b000-000000000001', 'ea000000-0000-4000-b000-000000000001', 6, 480, 720, 'America/Panama', 'Aula 10')
  ON CONFLICT DO NOTHING;
`);

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
