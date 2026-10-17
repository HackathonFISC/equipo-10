import pg from 'pg';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Database } from '../../apps/api/src/infrastructure/database';
import type { APIConfig } from '../../apps/api/src/config';
export type DatabaseFixture = Awaited<ReturnType<typeof setupTestDatabase>>;

// D7 has its own container; never reset Gemini's database on port 55435.
export async function setupTestDatabase() {
  const root = resolve(import.meta.dir, '../..');
  const admin = new pg.Client({ connectionString: 'postgres://postgres:d7-local-test-only@127.0.0.1:55445/aimpulsa_d7_test' });
  await admin.connect();
  const identity = (await admin.query('SELECT current_database() AS db, inet_server_port() AS port')).rows[0];
  if (identity.db !== 'aimpulsa_d7_test') { await admin.end(); throw new Error('D7_ISOLATED_DATABASE_REQUIRED'); }
  await admin.query(`DROP SCHEMA IF EXISTS app CASCADE;
    DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$;`);
  const migrations = readdirSync(resolve(root,'prisma/migrations')).filter((name) => /^\d/.test(name)).sort();
  await admin.query(readFileSync(resolve(root,'prisma/migrations/202610160001_profile/migration.sql'),'utf8'));
  await admin.query(readFileSync(resolve(root,'prisma/runtime-access.sql'),'utf8'));
  await admin.query(`DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='equipo10_api') THEN CREATE ROLE equipo10_api LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'd7-api-test-only'; END IF;
    END $$; GRANT equipo10_runtime TO equipo10_api WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`);
  for (const name of migrations.filter((name) => name !== '202610160001_profile')) {
    const path = resolve(root, 'prisma/migrations', name, 'migration.sql');
    if (existsSync(path)) await admin.query(readFileSync(path,'utf8'));
  }
  const config: APIConfig = { databaseUrl: 'postgres://equipo10_api:d7-api-test-only@127.0.0.1:55445/aimpulsa_d7_test', caFile: null,
    testDatabase: true, supabaseUrl: 'http://127.0.0.1:55448', publishableKey:'sb_publishable_d7_test', allowedOrigins:['http://127.0.0.1:5177'], host:'127.0.0.1',port:55447 };
  const db = new Database(config);
  return { admin, db, config, close: async () => { await db.close(); await admin.end(); } };
}
