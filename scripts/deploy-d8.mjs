import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { validateDestinationConfig, sanitizeUrlForPg } from './deploy-db.mjs';

// Load .env automatically if environment variables are not pre-set
if (!process.env.SUPABASE_URL && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'\r\n]+)["']?/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

export const baseMigrations = [
  '202610160001_profile',
  '202610160002_identity',
  '202610170001_opportunities',
  '202610170002_courses_and_reservations',
  '202610170003_applications_and_recruitment',
  '202610170004_training_center_access',
  '202610170005_training_completion',
  '202610170006_training_workspace',
  '202610170007_training_assessments',
  '202610170008_training_certificate',
  '202610170009_company_scope',
];

export const migrationNames = [
  '202610170010_independent_orientation',
];

const newTables = [
  'OrientationCounselor',
  'OrientationEngagement',
  'OrientationReview',
  'OrientationClarification',
];

const newEnums = [
  'OrientationRequestStatus',
  'OrientationReviewDecision',
  'ClarificationDecision',
];

const privateFunctions = [
  'counselor_has_active_engagement_for_plan',
  'counselor_has_active_engagement_for_revision',
  'counselor_has_active_engagement_for_profile',
];

const tablesByMigration = {
  '202610170010_independent_orientation': newTables,
};

export function migrationBody(sql) {
  return sql.replace(/^\s*BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
}

export function assertCleanMigration(record, checksum, name) {
  if (record && (!record.finished_at || record.rolled_back_at || record.checksum !== checksum)) {
    throw new Error(`migration_not_clean:${name}`);
  }
}

export async function deploy(mode = '--check') {
  if (!['--check', '--apply', '--verify'].includes(mode)) throw new Error('invalid_mode');

  validateDestinationConfig({
    supabaseUrl: process.env.SUPABASE_URL,
    directUrl: process.env.DIRECT_URL,
    databaseUrl: process.env.DATABASE_URL,
  });

  const tls = {
    ca: fs.readFileSync(process.env.DATABASE_SSL_CA_FILE || 'certs/supabase-prod-ca-2021.crt', 'utf8'),
    rejectUnauthorized: true,
  };

  const client = new pg.Client({
    connectionString: sanitizeUrlForPg(process.env.DIRECT_URL),
    ssl: tls,
    connectionTimeoutMillis: 8000,
    query_timeout: 30000,
  });

  const files = migrationNames.map((name) => {
    const sql = fs.readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
    return { name, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
  });

  let open = false;
  try {
    await client.connect();
    await client.query(mode === '--apply' ? 'BEGIN' : 'BEGIN READ ONLY');
    open = true;

    if (mode === '--apply') {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('aimpulsa:deployment:d8',0))");
    }

    const ledger = (
      await client.query(
        'SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations'
      )
    ).rows;

    // Verificar que todas las migraciones base estén debidamente aplicadas
    for (const base of baseMigrations) {
      if (!ledger.some((r) => r.migration_name === base && r.finished_at && !r.rolled_back_at)) {
        throw new Error(`base_migration_missing:${base}`);
      }
    }

    const existingTables = (
      await client.query(
        "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relname=ANY($1)",
        [newTables]
      )
    ).rows;

    const pending = [];
    for (const f of files) {
      const record = ledger.find((r) => r.migration_name === f.name && !r.rolled_back_at);
      assertCleanMigration(record, f.checksum, f.name);
      const owned = tablesByMigration[f.name] ?? [];

      if (!record && owned.some((t) => existingTables.some((r) => r.relname === t))) {
        throw new Error(`unrecorded_schema_requires_review:${f.name}`);
      }
      if (record && owned.some((t) => !existingTables.some((r) => r.relname === t && r.relrowsecurity))) {
        throw new Error(`recorded_schema_incomplete:${f.name}`);
      }
      if (!record) pending.push(f);
    }

    const countTables = ['CandidateProfile', 'ProfileRevision', 'Opportunity', 'Course', 'CourseReservation'];
    const counts = async () => {
      const result = {};
      for (const t of countTables) {
        result[t] = (await client.query(`SELECT count(*)::text AS n FROM app."${t}"`)).rows[0].n;
      }
      return result;
    };
    const beforeCounts = await counts();

    if (mode === '--verify' && pending.length > 0) {
      throw new Error(`pending_migrations:${pending.map((p) => p.name).join(',')}`);
    }

    if (mode === '--apply') {
      for (const f of pending) {
        await client.query(migrationBody(f.sql));
        await client.query(
          'INSERT INTO public._prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES($1,$2,$3,NOW(),NOW(),1)',
          [crypto.randomUUID(), f.checksum, f.name]
        );
      }
    }

    const afterCounts = await counts();
    if (JSON.stringify(beforeCounts) !== JSON.stringify(afterCounts)) {
      throw new Error('existing_business_rows_changed');
    }

    // Si ya están aplicadas o se acaban de aplicar, verificar integridad exhaustiva
    if (mode !== '--check' || pending.length === 0) {
      // 1. Validar que todas las nuevas tablas tienen RLS habilitado
      const tableRows = (
        await client.query(
          "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relname=ANY($1)",
          [newTables]
        )
      ).rows;
      if (tableRows.length !== newTables.length || tableRows.some((r) => !r.relrowsecurity)) {
        throw new Error('new_tables_or_rls_missing');
      }

      // 2. Validar que los nuevos enums existen en el esquema app
      const enumRows = (
        await client.query(
          "SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='app' AND t.typname=ANY($1)",
          [newEnums]
        )
      ).rows;
      if (enumRows.length !== newEnums.length) {
        throw new Error('new_enums_missing');
      }

      // 3. Validar que las funciones privadas security definer NO están expuestas a anon ni authenticated
      const exposedFuncs = (
        await client.query(
          "SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.prosecdef AND p.proname=ANY($1) AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))",
          [privateFunctions]
        )
      ).rows;
      if (exposedFuncs.length > 0) {
        throw new Error(`private_functions_exposed:${exposedFuncs.map((f) => f.proname).join(',')}`);
      }
    }

    await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');
    open = false;

    // Verificación de aislamiento en tiempo de ejecución con rol equipo10_runtime
    if (mode === '--verify') {
      const runtimeClient = new pg.Client({
        connectionString: sanitizeUrlForPg(process.env.DATABASE_URL),
        ssl: tls,
        connectionTimeoutMillis: 8000,
        query_timeout: 15000,
      });
      try {
        await runtimeClient.connect();
        await runtimeClient.query('BEGIN READ ONLY');
        await runtimeClient.query('SET LOCAL ROLE equipo10_runtime');
        for (const t of newTables) {
          const rows = await runtimeClient.query(`SELECT * FROM app."${t}" LIMIT 1`);
          if (rows.rowCount > 0 && t !== 'OrientationCounselor') {
            throw new Error(`private_rows_visible_without_actor:${t}`);
          }
        }
        await runtimeClient.query('ROLLBACK');
      } finally {
        await runtimeClient.end();
      }
    }

    return {
      status: mode.slice(2) + '_success',
      pending: mode === '--apply' ? [] : pending.map((f) => f.name),
      applied_now: mode === '--apply' ? pending.map((f) => f.name) : [],
      existing_business_rows_unchanged: true,
      runtime_verified: mode === '--verify',
    };
  } finally {
    if (open) await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await deploy(process.argv[2] || '--check');
    console.info(JSON.stringify(result));
  } catch (e) {
    console.error(
      JSON.stringify({
        status: 'failed',
        code: e.code ?? 'DEPLOY_ERROR',
        message: String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]'),
      })
    );
    process.exitCode = 1;
  }
}
