import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { readConfig } from "../../apps/api/src/config";
import { AppError } from "../../apps/api/src/errors";

const caFile = resolve(import.meta.dir, "../../certs/supabase-prod-ca-2021.crt");

describe("API Config Validation", () => {
  const baseProd = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://equipo10_api:testpass@db.fake-ref.supabase.co:5432/postgres",
    SUPABASE_URL: "https://fake-ref.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
    DATABASE_SSL_CA_FILE: caFile,
  };

  it("accepts valid production direct connection", () => {
    const cfg = readConfig(baseProd);
    expect(cfg.testDatabase).toBe(false);
    expect(cfg.supabaseUrl).toBe("https://fake-ref.supabase.co");
    expect(cfg.caFile).toBe(caFile);
  });

  it("accepts valid production pooler connection", () => {
    const cfg = readConfig({
      ...baseProd,
      DATABASE_URL: "postgresql://equipo10_api.fake-ref:testpass@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
    });
    expect(cfg.testDatabase).toBe(false);
  });

  it("ignores DIRECT_URL if present in production environment", () => {
    const cfg = readConfig({
      ...baseProd,
      DIRECT_URL: "postgres://postgres:ownersecret@db.fake-ref.supabase.co:5432/postgres",
    });
    expect(cfg.databaseUrl).toBe(baseProd.DATABASE_URL);
  });

  it("refuses runtime owner postgres", () => {
    expect(() =>
      readConfig({
        ...baseProd,
        DATABASE_URL: "postgresql://postgres:testpass@db.fake-ref.supabase.co:5432/postgres",
      })
    ).toThrow(AppError);
  });

  it("refuses wrong project host or mismatched project ref", () => {
    expect(() =>
      readConfig({
        ...baseProd,
        DATABASE_URL: "postgresql://equipo10_api:testpass@db.wrong-ref.supabase.co:5432/postgres",
      })
    ).toThrow(AppError);
  });

  it("refuses non-5432 port, arbitrary host, or host query overrides", () => {
    expect(() =>
      readConfig({
        ...baseProd,
        DATABASE_URL: "postgresql://equipo10_api:testpass@db.fake-ref.supabase.co:6543/postgres",
      })
    ).toThrow(AppError);

    expect(() =>
      readConfig({
        ...baseProd,
        DATABASE_URL: "postgresql://equipo10_api:testpass@arbitrary.host.com:5432/postgres",
      })
    ).toThrow(AppError);

    expect(() =>
      readConfig({
        ...baseProd,
        DATABASE_URL: "postgresql://equipo10_api:testpass@db.fake-ref.supabase.co:5432/postgres?host=other.com",
      })
    ).toThrow(AppError);
  });

  it("refuses missing CA file path in production", () => {
    expect(() =>
      readConfig({
        ...baseProd,
        DATABASE_SSL_CA_FILE: "certs/non-existent-ca.crt",
      })
    ).toThrow(AppError);
  });

  it("refuses sb_secret_ key or service_role key", () => {
    expect(() =>
      readConfig({
        ...baseProd,
        SUPABASE_PUBLISHABLE_KEY: "sb_secret_fake_key",
      })
    ).toThrow(AppError);

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
    const serviceRoleKey = `${header}.${payload}.signature`;

    expect(() =>
      readConfig({
        ...baseProd,
        SUPABASE_PUBLISHABLE_KEY: serviceRoleKey,
      })
    ).toThrow(AppError);
  });

  it("requires TEST_DATABASE_URL in test environment and rejects missing or remote test URL", () => {
    expect(() =>
      readConfig({
        NODE_ENV: "test",
        DATABASE_URL: baseProd.DATABASE_URL,
        SUPABASE_URL: "http://127.0.0.1:55436",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      })
    ).toThrow(AppError);

    expect(() =>
      readConfig({
        NODE_ENV: "test",
        TEST_DATABASE_URL: "postgres://equipo10_api:test@db.fake-ref.supabase.co:5432/equipo10_d1_test",
        SUPABASE_URL: "http://127.0.0.1:55436",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      })
    ).toThrow(AppError);
  });

  it("refuses wrong test port, database name, or test queries", () => {
    expect(() =>
      readConfig({
        NODE_ENV: "test",
        TEST_DATABASE_URL: "postgres://equipo10_api:test@127.0.0.1:5432/equipo10_d1_test",
        SUPABASE_URL: "http://127.0.0.1:55436",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      })
    ).toThrow(AppError);

    expect(() =>
      readConfig({
        NODE_ENV: "test",
        TEST_DATABASE_URL: "postgres://equipo10_api:test@127.0.0.1:55435/wrong_db",
        SUPABASE_URL: "http://127.0.0.1:55436",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      })
    ).toThrow(AppError);

    expect(() =>
      readConfig({
        NODE_ENV: "test",
        TEST_DATABASE_URL: "postgres://equipo10_api:test@127.0.0.1:55435/equipo10_d1_test?host=other",
        SUPABASE_URL: "http://127.0.0.1:55436",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      })
    ).toThrow(AppError);
  });

  it("accepts proper dedicated local test database without CA", () => {
    const cfg = readConfig({
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgres://equipo10_api:d1-test-only-password@127.0.0.1:55435/equipo10_d1_test",
      SUPABASE_URL: "http://127.0.0.1:55436",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(cfg.testDatabase).toBe(true);
    expect(cfg.caFile).toBeNull();
  });
});
