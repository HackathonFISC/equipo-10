import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
import { validateDestinationConfig, sanitizeUrlForPg } from './deploy-db.mjs';

const mode = process.argv[2] || '--check';
if (!['--check', '--apply', '--verify'].includes(mode)) throw new Error('invalid_mode');

validateDestinationConfig({
  supabaseUrl: process.env.SUPABASE_URL,
  directUrl: process.env.DIRECT_URL,
  databaseUrl: process.env.DATABASE_URL,
});

const client = new pg.Client({
  connectionString: sanitizeUrlForPg(process.env.DIRECT_URL),
  ssl: {
    ca: fs.readFileSync(process.env.DATABASE_SSL_CA_FILE || 'certs/supabase-prod-ca-2021.crt', 'utf8'),
    rejectUnauthorized: true,
  },
  connectionTimeoutMillis: 8000,
  query_timeout: 30000,
});

const migrationName = '202610170002_courses_and_reservations';
const sql = fs.readFileSync(`prisma/migrations/${migrationName}/migration.sql`, 'utf8');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');

const tables = [
  'Course',
  'CourseVersion',
  'CourseLearningOutcome',
  'CoursePrerequisite',
  'CourseEdition',
  'CourseSession',
  'LearningPlan',
  'LearningPlanStep',
  'LearningPlanExplanation',
  'CourseReservation',
];

const textReport = {};
const demo = {
  catalog: 'd4100000-0000-4000-8000-000000000001',
  organization: 'd4100000-0000-4000-8000-000000000002',
  skill: 'd4100000-0000-4000-8000-000000000003',
  course: 'd4100000-0000-4000-8000-000000000004',
  version: 'd4100000-0000-4000-8000-000000000005',
  edition: 'd4100000-0000-4000-8000-000000000006',
  session: 'd4100000-0000-4000-8000-000000000007',
  outcome: 'd4100000-0000-4000-8000-000000000008',
};

async function inspect() {
  const migrations = (
    await client.query(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations'
    )
  ).rows;

  for (const name of ['202610160001_profile', '202610160002_identity', '202610170001_opportunities']) {
    if (!migrations.some((row) => row.migration_name === name && row.finished_at && !row.rolled_back_at)) {
      throw new Error(`base_migration_missing_${name}`);
    }
  }

  const recorded = migrations.find((row) => row.migration_name === migrationName && !row.rolled_back_at);
  if (recorded && (!recorded.finished_at || recorded.checksum !== checksum)) {
    throw new Error('d4_migration_not_clean');
  }

  const present = (
    await client.query(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='app' AND c.relname=ANY($1)`,
      [tables]
    )
  ).rows;

  if ((recorded && present.length !== tables.length) || (!recorded && present.length)) {
    throw new Error('partial_d4_schema_requires_review');
  }

  return {
    applied: Boolean(recorded),
    tables: present.length,
    rls: present.every((row) => row.relrowsecurity),
  };
}

async function seedDemo() {
  await client.query(
    `INSERT INTO app."CatalogVersion" (id,code,"sourceLabel")
     VALUES ($1,'AIMPULSA-DEMO-D4-01','Catálogo sintético de formación AImpulsa')
     ON CONFLICT DO NOTHING`,
    [demo.catalog]
  );

  await client.query(
    `INSERT INTO app."Organization" (id,name,type,active,"updatedAt")
     VALUES ($1,'Centro ficticio AImpulsa DEMO','TRAINING_CENTER',true,NOW())
     ON CONFLICT DO NOTHING`,
    [demo.organization]
  );

  await client.query(
    `INSERT INTO app."CompetencyEntry" (id,"catalogVersionId",code,name,description,kind)
     VALUES ($1,$2,'DEMO-COMP-INV-01','Registro de Inventario Básico','Manejo de entradas, salidas y kardex','SKILL')
     ON CONFLICT DO NOTHING`,
    [demo.skill, demo.catalog]
  );

  await client.query(
    `INSERT INTO app."Course" (id,"organizationId",code,title,description,active,"isDemo","createdAt","updatedAt")
     VALUES ($1,$2,'CUR-DEMO-01','Control y Gestión de Inventarios Básicos','Curso práctico sobre registro de existencias y control de almacén.',true,true,NOW(),NOW())
     ON CONFLICT DO NOTHING`,
    [demo.course, demo.organization]
  );

  await client.query(
    `INSERT INTO app."CourseVersion" (id,"courseId","catalogVersionId","versionNumber","syllabusText","durationHours","confirmedAt")
     VALUES ($1,$2,$3,1,'Módulo 1: Almacén. Módulo 2: Kardex digital.',40,NOW())
     ON CONFLICT DO NOTHING`,
    [demo.version, demo.course, demo.catalog]
  );

  await client.query(
    `INSERT INTO app."CourseLearningOutcome" (id,"courseVersionId","competencyId","catalogVersionId",description)
     VALUES ($1,$2,$3,$4,'Resultado esperado de demostración: registrar entradas y salidas de inventario. No acredita aprendizaje por reservar.')
     ON CONFLICT DO NOTHING`,
    [demo.outcome, demo.version, demo.skill, demo.catalog]
  );

  await client.query(
    `INSERT INTO app."CourseEdition" (
       id,"courseVersionId",modality,"startDate","endDate","totalSlots","availableSlots",
       "costAmount","costCurrency","costPeriod","scheduleSummary",active,"isDemo","publishedAt"
     ) VALUES (
       $1,$2,'ON_SITE',CURRENT_DATE + INTERVAL '10 days',CURRENT_DATE + INTERVAL '30 days',10,10,
       40.00,'USD','TOTAL','Sábados 08:00 - 12:00',true,true,NOW()
     ) ON CONFLICT DO NOTHING`,
    [demo.edition, demo.version]
  );

  await client.query(
    `INSERT INTO app."CourseSession" (id,"editionId",weekday,"startMinute","endMinute",timezone,location)
     VALUES ($1,$2,6,480,720,'America/Panama','Sede ficticia AImpulsa DEMO')
     ON CONFLICT DO NOTHING`,
    [demo.session, demo.edition]
  );
}

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('aimpulsa-deploy-d4'))");

  const before = await inspect();

  const counts = (
    await client.query(
      `SELECT
         (SELECT count(*) FROM app."CandidateProfile")::int AS profiles,
         (SELECT count(*) FROM app."ProfileRevision")::int AS revisions,
         (SELECT count(*) FROM app."Opportunity")::int AS opportunities`
    )
  ).rows[0];

  if (mode === '--apply') {
    if (!before.applied) {
      await client.query(sql.replace(/^\s*BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, ''));
      await client.query(
        `INSERT INTO public._prisma_migrations (id,checksum,migration_name,started_at,finished_at,applied_steps_count)
         VALUES ($1,$2,$3,NOW(),NOW(),1)`,
        [crypto.randomUUID(), checksum, migrationName]
      );
    }
    await seedDemo();
    // SECURITY DEFINER aggregate is for the API runtime, not the public Data API.
    await client.query('REVOKE EXECUTE ON FUNCTION app.count_active_reservations(uuid) FROM PUBLIC, anon, authenticated');
  }

  const after = await inspect();
  if (mode !== '--check' && (!after.applied || !after.rls)) {
    throw new Error('d4_verification_failed');
  }

  if (after.applied) {
    const grants = await client.query(
      `SELECT bool_and(has_table_privilege('equipo10_runtime', format('app.%I',name), 'SELECT')) AS ok
       FROM unnest($1::text[]) AS name`,
      [tables]
    );
    if (!grants.rows[0].ok) throw new Error('runtime_grants_missing');

    const visible = await client.query('SELECT count(*)::int AS n FROM app."Course" WHERE "isDemo"=true');
    textReport.demoVisible = visible.rows[0].n;
  }

  const unchanged = (
    await client.query(
      `SELECT
         (SELECT count(*) FROM app."CandidateProfile")::int AS profiles,
         (SELECT count(*) FROM app."ProfileRevision")::int AS revisions,
         (SELECT count(*) FROM app."Opportunity")::int AS opportunities`
    )
  ).rows[0];

  if (JSON.stringify(counts) !== JSON.stringify(unchanged)) {
    throw new Error('existing_tables_counts_changed');
  }

  await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');

  if (after.applied && mode === '--verify') {
    const runtime = new pg.Client({
      connectionString: sanitizeUrlForPg(process.env.DATABASE_URL),
      ssl: {
        ca: fs.readFileSync(process.env.DATABASE_SSL_CA_FILE || 'certs/supabase-prod-ca-2021.crt', 'utf8'),
        rejectUnauthorized: true,
      },
      connectionTimeoutMillis: 8000,
      query_timeout: 15000,
    });

    try {
      await runtime.connect();
      await runtime.query('BEGIN READ ONLY');
      await runtime.query('SET LOCAL ROLE equipo10_runtime');

      const visible = await runtime.query('SELECT count(*)::int AS n FROM app."Course" WHERE "isDemo"=true');
      await runtime.query(
        `SELECT c.id FROM app."Course" c
         JOIN app."Organization" org ON org.id=c."organizationId"
         JOIN app."CourseVersion" cv ON cv."courseId"=c.id
         JOIN app."CourseEdition" ce ON ce."courseVersionId"=cv.id
         LIMIT 1`
      );
      await runtime.query('SELECT id FROM app."CourseLearningOutcome" LIMIT 1');
      await runtime.query('SELECT id FROM app."CoursePrerequisite" LIMIT 1');
      await runtime.query('SELECT id FROM app."CourseSession" LIMIT 1');
      const functionAccess = await runtime.query("SELECT has_function_privilege('anon','app.count_active_reservations(uuid)','EXECUTE') AS anon_access, has_function_privilege('authenticated','app.count_active_reservations(uuid)','EXECUTE') AS authenticated_access");
      if (functionAccess.rows[0].anon_access || functionAccess.rows[0].authenticated_access) throw new Error('public_capacity_function_access');

      const privateRows = await runtime.query(
        'SELECT id FROM app."LearningPlan" UNION ALL SELECT id FROM app."CourseReservation"'
      );
      if (privateRows.rowCount) throw new Error('private_rows_visible_without_actor');

      // Comprobar función de conteo de capacidad
      const countRes = await runtime.query(
        'SELECT app.count_active_reservations(gen_random_uuid()) AS count'
      );
      if (countRes.rows[0]?.count === undefined) throw new Error('capacity_function_not_working');

      await runtime.query('ROLLBACK');
      textReport.runtimeDemoVisible = visible.rows[0].n;
      textReport.privateRowsHiddenWithoutActor = true;
      textReport.capacityFunctionWorking = true;
    } finally {
      await runtime.end();
    }
  }

  console.log(
    JSON.stringify({
      status: mode.slice(2) + '_success',
      ...after,
      ...textReport,
      existingCountsUnchanged: true,
    })
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(
    JSON.stringify({
      status: 'failed',
      code: error.code || 'DEPLOY_D4_ERROR',
      message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]'),
    })
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
