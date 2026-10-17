import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateDestinationConfig,
  stripOuterTransaction,
  replaceDatabaseUrlInEnv,
  buildNewDatabaseUrl,
  sanitizeUrlForPg,
  extractProjectRefFromUrl,
} from './deploy-db.mjs';

function testUrlSanitization() {
  const url = 'postgresql://user:pass@db.myproj.supabase.co:5432/postgres?sslmode=require&sslrootcert=ca.crt&other=1';
  const sanitized = sanitizeUrlForPg(url);
  assert.ok(!sanitized.includes('sslmode'), 'sslmode should be deleted');
  assert.ok(!sanitized.includes('sslrootcert'), 'sslrootcert should be deleted');
  assert.ok(sanitized.includes('other=1'), 'non-ssl query params preserved');
}

function testDestinationRefExtraction() {
  const hostUrl = 'postgresql://postgres:pass@db.abcxyz.supabase.co:5432/postgres';
  assert.equal(extractProjectRefFromUrl(hostUrl), 'abcxyz');

  const poolerUrl = 'postgresql://postgres.abcxyz:pass@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';
  assert.equal(extractProjectRefFromUrl(poolerUrl), 'abcxyz');
}

function testDestinationValidationSuccess() {
  const valid = {
    supabaseUrl: 'https://proj123.supabase.co',
    directUrl: 'postgresql://postgres:secret@db.proj123.supabase.co:5432/postgres',
    databaseUrl: 'postgresql://postgres.proj123:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
  };
  const res = validateDestinationConfig(valid);
  assert.equal(res.projectRef, 'proj123');
}

function testDestinationValidationSessionPoolerDirectUrl() {
  const validPoolerDirect = {
    supabaseUrl: 'https://proj123.supabase.co',
    directUrl: 'postgresql://postgres.proj123:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
    databaseUrl: 'postgresql://postgres.proj123:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
  };
  const res = validateDestinationConfig(validPoolerDirect);
  assert.equal(res.projectRef, 'proj123');
}

function testDestinationValidationRejectsMismatch() {
  assert.throws(() => {
    validateDestinationConfig({
      supabaseUrl: 'https://proj123.supabase.co',
      directUrl: 'postgresql://postgres:secret@db.otherref.supabase.co:5432/postgres',
    });
  }, /DIRECT_URL_destination_mismatch/);
}

function testDestinationValidationRejectsPort6543() {
  assert.throws(() => {
    validateDestinationConfig({
      supabaseUrl: 'https://proj123.supabase.co',
      directUrl: 'postgresql://postgres:secret@db.proj123.supabase.co:5432/postgres',
      databaseUrl: 'postgresql://postgres.proj123:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
    });
  }, /invalid_DATABASE_URL_port_expected_5432/);
}

function testDestinationValidationRejectsHostSpoofAndMismatch() {
  assert.throws(() => {
    validateDestinationConfig({
      supabaseUrl: 'https://proj123.supabase.co',
      directUrl: 'postgresql://postgres:secret@evilhost.com:5432/postgres',
    });
  }, /DIRECT_URL_destination_mismatch/);

  assert.throws(() => {
    validateDestinationConfig({
      supabaseUrl: 'https://proj123.supabase.co',
      directUrl: 'postgresql://postgres.proj123:secret@evilhost.com:5432/postgres',
    });
  }, /DIRECT_URL_destination_mismatch/);

  assert.throws(() => {
    validateDestinationConfig({
      supabaseUrl: 'https://proj123.supabase.co',
      directUrl: 'postgresql://postgres:secret@db.proj123.supabase.co:5432/postgres',
      databaseUrl: 'postgresql://postgres.proj123:secret@evilhost.com:5432/postgres',
    });
  }, /DATABASE_URL_host_forbidden/);

  assert.throws(() => {
    validateDestinationConfig({
      supabaseUrl: 'https://proj123.supabase.co',
      directUrl: 'postgresql://postgres:secret@db.proj123.supabase.co:5432/postgres',
      databaseUrl: 'postgresql://postgres.wrongref:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
    });
  }, /DATABASE_URL_destination_mismatch/);

  assert.throws(() => {
    validateDestinationConfig({
      supabaseUrl: 'http://proj123.supabase.co',
      directUrl: 'postgresql://postgres:secret@db.proj123.supabase.co:5432/postgres',
    });
  }, /invalid_SUPABASE_URL_protocol_expected_https/);
}

function testPercentEncodedCredentials() {
  const url = 'postgresql://user%2Esub.proj123:p%40ss%23word@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';
  assert.equal(extractProjectRefFromUrl(url), 'proj123');
  const validated = validateDestinationConfig({
    supabaseUrl: 'https://proj123.supabase.co',
    directUrl: 'postgresql://postgres:secret@db.proj123.supabase.co:5432/postgres',
    databaseUrl: url,
  });
  assert.equal(validated.projectRef, 'proj123');
}

function testStripOuterTransaction() {
  const validSql = 'BEGIN;\nCREATE TABLE app.test (id int);\nCOMMIT;';
  const stripped = stripOuterTransaction(validSql);
  assert.equal(stripped, 'CREATE TABLE app.test (id int);');

  assert.throws(() => {
    stripOuterTransaction('CREATE TABLE app.test (id int); COMMIT;');
  }, /runtime_sql_missing_leading_BEGIN/);

  assert.throws(() => {
    stripOuterTransaction(`BEGIN;
CREATE TABLE app.test (id int);`);
  }, /runtime_sql_missing_trailing_COMMIT/);

  const runtimeSqlPath = path.resolve(process.cwd(), 'prisma/runtime-access.sql');
  const originalContent = fs.readFileSync(runtimeSqlPath, 'utf8');
  const strippedRuntime = stripOuterTransaction(originalContent);
  assert.ok(strippedRuntime.includes('DO $$'), 'Stripped SQL retains DO $$ block');
  assert.ok(strippedRuntime.includes('BEGIN'), 'Stripped SQL retains internal BEGIN block');
  assert.ok(!strippedRuntime.startsWith('BEGIN;'), 'Exterior BEGIN; stripped');
  assert.ok(!strippedRuntime.endsWith('COMMIT;'), 'Exterior COMMIT; stripped');
  const afterContent = fs.readFileSync(runtimeSqlPath, 'utf8');
  assert.equal(originalContent, afterContent, 'runtime-access.sql unchanged on disk');
}

function testBuildNewDatabaseUrl() {
  const existing = 'postgresql://postgres.proj123:oldpwd@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require';
  const built = buildNewDatabaseUrl(existing, 'equipo10_api.proj123', 'new_pass-123_456');
  const parsed = new URL(built);
  assert.equal(parsed.username, 'equipo10_api.proj123');
  assert.equal(parsed.password, 'new_pass-123_456');
  assert.equal(parsed.searchParams.get('sslmode'), 'require');
}

function testReplaceDatabaseUrlInEnv() {
  const envLF = [
    'NODE_ENV=production',
    'DATABASE_URL="postgresql://old:secret@db.host.com:5432/postgres"',
    'DIRECT_URL="postgresql://admin:secret@db.host.com:5432/postgres"',
  ].join('\n');

  const replacedLF = replaceDatabaseUrlInEnv(envLF, 'postgresql://new:secret@db.host.com:5432/postgres');
  assert.ok(replacedLF.includes('DATABASE_URL="postgresql://new:secret@db.host.com:5432/postgres"'));
  assert.ok(replacedLF.includes('DIRECT_URL="postgresql://admin:secret@db.host.com:5432/postgres"'));
  assert.ok(replacedLF.includes('NODE_ENV=production'));
  assert.equal(replacedLF, [
    'NODE_ENV=production',
    'DATABASE_URL="postgresql://new:secret@db.host.com:5432/postgres"',
    'DIRECT_URL="postgresql://admin:secret@db.host.com:5432/postgres"',
  ].join('\n'));

  const envCRLF = [
    'NODE_ENV=production',
    'DATABASE_URL="postgresql://old:secret@db.host.com:5432/postgres"',
    'DIRECT_URL="postgresql://admin:secret@db.host.com:5432/postgres"',
  ].join('\r\n');

  const replacedCRLF = replaceDatabaseUrlInEnv(envCRLF, 'postgresql://new:secret@db.host.com:5432/postgres');
  assert.equal(replacedCRLF, [
    'NODE_ENV=production',
    'DATABASE_URL="postgresql://new:secret@db.host.com:5432/postgres"',
    'DIRECT_URL="postgresql://admin:secret@db.host.com:5432/postgres"',
  ].join('\r\n'), 'CRLF preserved byte for byte');

  const duplicatedEnv = [
    'DATABASE_URL="postgresql://one@host:5432/db"',
    'DATABASE_URL="postgresql://two@host:5432/db"',
  ].join('\n');
  assert.throws(() => replaceDatabaseUrlInEnv(duplicatedEnv, 'new'), /DATABASE_URL_duplicated_in_env/);

  const missingEnv = 'DIRECT_URL="postgresql://admin@host:5432/db"';
  assert.throws(() => replaceDatabaseUrlInEnv(missingEnv, 'new'), /DATABASE_URL_not_found_in_env/);
}

function runAll() {
  testUrlSanitization();
  testDestinationRefExtraction();
  testDestinationValidationSuccess();
  testDestinationValidationSessionPoolerDirectUrl();
  testDestinationValidationRejectsMismatch();
  testDestinationValidationRejectsPort6543();
  testDestinationValidationRejectsHostSpoofAndMismatch();
  testPercentEncodedCredentials();
  testStripOuterTransaction();
  testBuildNewDatabaseUrl();
  testReplaceDatabaseUrlInEnv();
  console.log(JSON.stringify({ test_suite: 'deploy-db', passed: 11, status: 'ok' }));
}

runAll();
