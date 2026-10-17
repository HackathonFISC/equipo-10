import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database } from "../../apps/api/src/infrastructure/database";
import { readConfig, type APIConfig } from "../../apps/api/src/config";
import { AppError } from "../../apps/api/src/errors";

export interface DatabaseFixture {
  admin: pg.Client;
  db: Database;
  config: APIConfig;
  close: () => Promise<void>;
}

export async function setupTestDatabase(): Promise<DatabaseFixture> {
  const rawUrl = process.env.TEST_DIRECT_URL ?? "postgres://postgres:equipo10-d1-local-only@127.0.0.1:55435/equipo10_d1_test";

  if (process.env.DIRECT_URL && rawUrl === process.env.DIRECT_URL) {
    throw new AppError(500, "CONFIG_ERROR", "Refusing to use DIRECT_URL as test database");
  }
  if (process.env.DATABASE_URL && rawUrl === process.env.DATABASE_URL) {
    throw new AppError(500, "CONFIG_ERROR", "Refusing to use DATABASE_URL as test database");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError(500, "CONFIG_ERROR", "Invalid TEST_DIRECT_URL format");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new AppError(500, "CONFIG_ERROR", "TEST_DIRECT_URL must use postgres protocol");
  }

  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new AppError(500, "CONFIG_ERROR", "TEST_DIRECT_URL host must be 127.0.0.1 or localhost");
  }

  if (parsed.port !== "55435") {
    throw new AppError(500, "CONFIG_ERROR", "TEST_DIRECT_URL port must be 55435");
  }

  const dbName = parsed.pathname.replace(/^\//, "");
  if (dbName !== "equipo10_d1_test") {
    throw new AppError(500, "CONFIG_ERROR", "TEST_DIRECT_URL database must be equipo10_d1_test");
  }

  if (parsed.search !== "") {
    throw new AppError(500, "CONFIG_ERROR", "TEST_DIRECT_URL must not contain query parameters");
  }

  const admin = new pg.Client({ connectionString: rawUrl });
  await admin.connect();

  const res = await admin.query<{ current_database: string }>("SELECT current_database();");
  if (res.rows[0]?.current_database !== "equipo10_d1_test") {
    await admin.end();
    throw new AppError(500, "CONFIG_ERROR", "Connected to wrong database for testing");
  }

  await admin.query(`
    DROP SCHEMA IF EXISTS app CASCADE;
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'equipo10_api') THEN
        DROP ROLE equipo10_api;
      END IF;
      IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'equipo10_runtime') THEN
        DROP ROLE equipo10_runtime;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
      END IF;
    END $$;
  `);

  const rootDir = resolve(import.meta.dir, "../..");
  const initSql = readFileSync(resolve(rootDir, "prisma/migrations/202610160001_profile/migration.sql"), "utf-8");
  await admin.query(initSql);

  const runtimeSql = readFileSync(resolve(rootDir, "prisma/runtime-access.sql"), "utf-8");
  await admin.query(runtimeSql);

  await admin.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'equipo10_api') THEN
        CREATE ROLE equipo10_api WITH LOGIN NOINHERIT NOBYPASSRLS
          NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
          PASSWORD 'd1-test-only-password';
      END IF;
    END $$;
    GRANT equipo10_runtime TO equipo10_api WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
  `);

  const identitySql = readFileSync(resolve(rootDir, "prisma/migrations/202610160002_identity/migration.sql"), "utf-8");
  await admin.query(identitySql);

  const opportunitiesSql = readFileSync(resolve(rootDir, "prisma/migrations/202610170001_opportunities/migration.sql"), "utf-8");
  await admin.query(opportunitiesSql);

  const coursesSql = readFileSync(resolve(rootDir, "prisma/migrations/202610170002_courses_and_reservations/migration.sql"), "utf-8");
  await admin.query(coursesSql);

  const recruitmentSql = readFileSync(resolve(rootDir, "prisma/migrations/202610170003_applications_and_recruitment/migration.sql"), "utf-8");
  await admin.query(recruitmentSql);

  const migs = [
    "202610170004_training_center_access",
    "202610170005_training_completion",
    "202610170006_training_workspace",
    "202610170007_training_assessments",
    "202610170008_training_certificate",
    "202610170009_company_scope",
    "202610170010_independent_orientation",
  ];
  for (const m of migs) {
    const sql = readFileSync(resolve(rootDir, `prisma/migrations/${m}/migration.sql`), "utf-8");
    await admin.query(sql);
  }

  const config = readConfig({
    NODE_ENV: "test",
    TEST_DATABASE_URL: "postgres://equipo10_api:d1-test-only-password@127.0.0.1:55435/equipo10_d1_test",
    SUPABASE_URL: process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55438",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_d1_test",
    HOST: "127.0.0.1",
    PORT: "3001",
  });

  const db = new Database(config);

  const close = async () => {
    await db.close();
    await admin.end();
  };

  return { admin, db, config, close };
}
