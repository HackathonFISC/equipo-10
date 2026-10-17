import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
import { validateDestinationConfig, sanitizeUrlForPg } from './deploy-db.mjs';

const mode = process.argv[2] || '--check';
if (!['--check', '--apply', '--verify'].includes(mode)) throw new Error('invalid_mode');
validateDestinationConfig({ supabaseUrl: process.env.SUPABASE_URL, directUrl: process.env.DIRECT_URL, databaseUrl: process.env.DATABASE_URL });
const client = new pg.Client({ connectionString: sanitizeUrlForPg(process.env.DIRECT_URL),
  ssl: { ca: fs.readFileSync(process.env.DATABASE_SSL_CA_FILE || 'certs/supabase-prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
  connectionTimeoutMillis: 8000, query_timeout: 30000 });
const migrationName = '202610170001_opportunities';
const sql = fs.readFileSync(`prisma/migrations/${migrationName}/migration.sql`, 'utf8');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');
const tables = ['Opportunity', 'OpportunityRequirement', 'OpportunityComparison', 'OpportunityExplanation'];
const textReport = {};
const demo = {
  catalog: 'd3100000-0000-4000-8000-000000000001', organization: 'd3100000-0000-4000-8000-000000000002',
  occupation: 'd3100000-0000-4000-8000-000000000003', skill: 'd3100000-0000-4000-8000-000000000004',
  opportunity: 'd3100000-0000-4000-8000-000000000005', requirement: 'd3100000-0000-4000-8000-000000000006',
};

async function inspect() {
  const migrations = (await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations')).rows;
  for (const name of ['202610160001_profile', '202610160002_identity']) {
    if (!migrations.some((row) => row.migration_name === name && row.finished_at && !row.rolled_back_at)) throw new Error('base_migration_missing');
  }
  const recorded = migrations.find((row) => row.migration_name === migrationName && !row.rolled_back_at);
  if (recorded && (!recorded.finished_at || recorded.checksum !== checksum)) throw new Error('d3_migration_not_clean');
  const present = (await client.query(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relname=ANY($1)`, [tables])).rows;
  if ((recorded && present.length !== 4) || (!recorded && present.length)) throw new Error('partial_d3_schema_requires_review');
  return { applied: Boolean(recorded), tables: present.length, rls: present.every((row) => row.relrowsecurity) };
}

async function seedDemo() {
  await client.query(`INSERT INTO app."CatalogVersion" (id,code,"sourceLabel") VALUES ($1,'AIMPULSA-DEMO-D3-01','Catálogo sintético de demostración AImpulsa; no ESCO oficial') ON CONFLICT DO NOTHING`, [demo.catalog]);
  await client.query(`INSERT INTO app."Organization" (id,name,type,active,"updatedAt") VALUES ($1,'Empresa ficticia AImpulsa DEMO','COMPANY',true,NOW()) ON CONFLICT DO NOTHING`, [demo.organization]);
  await client.query(`INSERT INTO app."OccupationEntry" (id,"catalogVersionId",code,name,description) VALUES ($1,$2,'DEMO-SOPORTE','Auxiliar de soporte tecnológico','Ocupación sintética para demostrar el recorrido de comparación.') ON CONFLICT DO NOTHING`, [demo.occupation,demo.catalog]);
  await client.query(`INSERT INTO app."CompetencyEntry" (id,"catalogVersionId",code,name,description,kind) VALUES ($1,$2,'DEMO-SOPORTE-USUARIOS','Atención de consultas de soporte','Registrar consultas y explicar pasos básicos al usuario.','SKILL') ON CONFLICT DO NOTHING`, [demo.skill,demo.catalog]);
  await client.query(`INSERT INTO app."Opportunity" (id,"organizationId",title,description,"occupationId","catalogVersionId",location,"workplaceType","salaryAmount","salaryCurrency","salaryPeriod","scheduleSummary","isDemo") VALUES ($1,$2,'Auxiliar de soporte — DEMO','Vacante ficticia para demostrar AImpulsa. No es una oferta laboral real ni permite postular.',$3,$4,'Ciudad de Panamá — ubicación demo','ON_SITE',700,'USD','MONTH','Lunes a Viernes 08:00 - 17:00',true) ON CONFLICT DO NOTHING`, [demo.opportunity,demo.organization,demo.occupation,demo.catalog]);
  await client.query(`INSERT INTO app."OpportunityRequirement" (id,"opportunityId","competencyId","catalogVersionId","requirementType",stage,description) VALUES ($1,$2,$3,$4,'ESSENTIAL','ENTRY','Atender y registrar consultas básicas de usuarios; requisito de demostración.') ON CONFLICT DO NOTHING`, [demo.requirement,demo.opportunity,demo.skill,demo.catalog]);
}

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('aimpulsa-deploy-d3'))");
  const before = await inspect();
  const counts = (await client.query(`SELECT (SELECT count(*) FROM app."CandidateProfile")::int AS profiles, (SELECT count(*) FROM app."ProfileRevision")::int AS revisions, (SELECT count(*) FROM app."ProfileExperience")::int AS experiences, (SELECT count(*) FROM app."TrainingDeclaration")::int AS trainings`)).rows[0];
  if (mode === '--apply') {
    if (!before.applied) {
      await client.query(sql.replace(/^\s*BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, ''));
      await client.query(`INSERT INTO public._prisma_migrations (id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES ($1,$2,$3,NOW(),NOW(),1)`, [crypto.randomUUID(),checksum,migrationName]);
    }
    await seedDemo();
  }
  const after = await inspect();
  if (mode !== '--check' && (!after.applied || !after.rls)) throw new Error('d3_verification_failed');
  if (after.applied) {
    const grants = await client.query(`SELECT bool_and(has_table_privilege('equipo10_runtime', format('app.%I',name), 'SELECT')) AS ok FROM unnest($1::text[]) AS name`, [tables]);
    if (!grants.rows[0].ok) throw new Error('runtime_grants_missing');
    const visible = await client.query('SELECT count(*)::int AS n FROM app."Opportunity" WHERE "isDemo"=true');
    textReport.demoVisible = visible.rows[0].n;
  }
  const unchanged = (await client.query(`SELECT (SELECT count(*) FROM app."CandidateProfile")::int AS profiles, (SELECT count(*) FROM app."ProfileRevision")::int AS revisions, (SELECT count(*) FROM app."ProfileExperience")::int AS experiences, (SELECT count(*) FROM app."TrainingDeclaration")::int AS trainings`)).rows[0];
  if (JSON.stringify(counts) !== JSON.stringify(unchanged)) throw new Error('existing_profile_counts_changed');
  await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');
  if (after.applied && mode === '--verify') {
    const runtime = new pg.Client({ connectionString: sanitizeUrlForPg(process.env.DATABASE_URL), ssl: { ca: fs.readFileSync(process.env.DATABASE_SSL_CA_FILE || 'certs/supabase-prod-ca-2021.crt','utf8'), rejectUnauthorized: true }, connectionTimeoutMillis:8000, query_timeout:15000 });
    try {
      await runtime.connect();
      await runtime.query('BEGIN READ ONLY');
      await runtime.query('SET LOCAL ROLE equipo10_runtime');
      const visible = await runtime.query('SELECT count(*)::int AS n FROM app."Opportunity" WHERE "isDemo"=true');
      await runtime.query('SELECT o.id FROM app."Opportunity" o JOIN app."Organization" org ON org.id=o."organizationId" JOIN app."OccupationEntry" occ ON occ.id=o."occupationId" AND occ."catalogVersionId"=o."catalogVersionId" LIMIT 1');
      await runtime.query('SELECT id FROM app."OpportunityRequirement" LIMIT 1');
      const privateRows = await runtime.query('SELECT id FROM app."OpportunityComparison" UNION ALL SELECT id FROM app."OpportunityExplanation"');
      if (privateRows.rowCount) throw new Error('private_rows_visible_without_actor');
      await runtime.query('ROLLBACK');
      textReport.runtimeDemoVisible = visible.rows[0].n;
      textReport.privateRowsHiddenWithoutActor = true;
    } finally { await runtime.end(); }
  }
  console.log(JSON.stringify({ status: mode.slice(2)+'_success', ...after, ...textReport, existingProfileCountsUnchanged: true }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ status:'failed', code: error.code || 'DEPLOY_D3_ERROR', message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]') }));
  process.exitCode=1;
} finally { await client.end(); }

