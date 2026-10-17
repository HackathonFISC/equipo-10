// Verificación rigurosa de privilegios y RLS para equipo10_runtime vía PGlite en memoria.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
const { PGlite } = modulePath
  ? await import(pathToFileURL(resolve(modulePath)).href)
  : await import('@electric-sql/pglite');

const migrationSql = 'prisma/migrations/202610160001_profile/migration.sql';
const runtimeSql = 'prisma/runtime-access.sql';
assert(existsSync(migrationSql), 'Prepared migration required');
assert(existsSync(runtimeSql), 'Runtime access sql required');

const db = new PGlite();
const results = [];
let failed = false;
const uid = () => randomUUID();
const digest = 'a'.repeat(64);

const a = { user: uid(), profile: uid(), revision: uid(), experience: uid() };
const b = { user: uid(), profile: uid(), revision: uid(), experience: uid() };

async function test(name, action) {
  await action();
  results.push({ name, status: 'passed' });
  console.log(JSON.stringify(results.at(-1)));
}

async function failsRuntime(code, action) {
  await assert.rejects(db.transaction(async (tx) => {
    await tx.query('SET LOCAL ROLE equipo10_runtime');
    await action(tx);
  }), (error) => error.code === code);
}

try {
  await test('setup migration and runtime sql as owner', async () => {
    await db.exec(readFileSync(migrationSql, 'utf8'));
    await db.exec(readFileSync(runtimeSql, 'utf8'));
  });

  // Semilla de catálogos y usuarios de prueba ejecutada por el owner
  const catVersion = uid();
  await db.query('INSERT INTO app."CatalogVersion" (id, code, "sourceLabel") VALUES ($1, $2, $3)', [catVersion, 'CAT-V1', 'Catálogo']);
  await db.query('INSERT INTO app."OccupationEntry" (id, "catalogVersionId", code, name, description) VALUES ($1, $2, $3, $4, $5)', [uid(), catVersion, 'DEV', 'Desarrollador', 'Desc']);

  for (const x of [a, b]) {
    await db.query('INSERT INTO app."AppUser" (id, "authSubject", "updatedAt") VALUES ($1, $2, now())', [x.user, uid()]);
    await db.query('INSERT INTO app."CandidateProfile" (id, "ownerUserId") VALUES ($1, $2)', [x.profile, x.user]);
    await db.query('INSERT INTO app."ProfileRevision" (id, "profileId", "displayName", "updatedAt") VALUES ($1, $2, $3, now())', [x.revision, x.profile, 'Draft Inicial']);
    await db.query('INSERT INTO app."ProfileExperience" (id, "profileId", "revisionId", kind, title, description) VALUES ($1, $2, $3, $4, $5, $6)', [x.experience, x.profile, x.revision, 'FORMAL', 'Experiencia Base', 'Desc']);
    await db.query('UPDATE app."ProfileRevision" SET "experienceStatus" = \'PROVIDED\', revision = revision + 1 WHERE id = $1', [x.revision]);
  }

  await test('runtime role without context GUC has zero access to catalog and data', async () => {
    await db.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE equipo10_runtime');
      const rCat = await tx.query('SELECT count(*)::int AS count FROM app."CatalogVersion"');
      assert.equal(rCat.rows[0].count, 0);
      const rUser = await tx.query('SELECT count(*)::int AS count FROM app."AppUser"');
      assert.equal(rUser.rows[0].count, 0);
      const rProf = await tx.query('SELECT count(*)::int AS count FROM app."CandidateProfile"');
      assert.equal(rProf.rows[0].count, 0);
    });
  });

  await test('runtime actor A sees only A data and can read catalog', async () => {
    await db.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE equipo10_runtime');
      await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [a.user]);
      const rCat = await tx.query('SELECT count(*)::int AS count FROM app."CatalogVersion"');
      assert.equal(rCat.rows[0].count, 1);
      const rUser = await tx.query('SELECT id FROM app."AppUser"');
      assert.equal(rUser.rows.length, 1);
      assert.equal(rUser.rows[0].id, a.user);
      const rProf = await tx.query('SELECT id FROM app."CandidateProfile"');
      assert.equal(rProf.rows.length, 1);
      assert.equal(rProf.rows[0].id, a.profile);
      const rExp = await tx.query('SELECT id FROM app."ProfileExperience"');
      assert.equal(rExp.rows.length, 1);
      assert.equal(rExp.rows[0].id, a.experience);
    });
  });

  await test('runtime actor B sees only B data and can read catalog', async () => {
    await db.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE equipo10_runtime');
      await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [b.user]);
      const rUser = await tx.query('SELECT id FROM app."AppUser"');
      assert.equal(rUser.rows.length, 1);
      assert.equal(rUser.rows[0].id, b.user);
      const rProf = await tx.query('SELECT id FROM app."CandidateProfile"');
      assert.equal(rProf.rows.length, 1);
      assert.equal(rProf.rows[0].id, b.profile);
      const rExp = await tx.query('SELECT id FROM app."ProfileExperience"');
      assert.equal(rExp.rows.length, 1);
      assert.equal(rExp.rows[0].id, b.experience);
    });
  });

  await test('invalid UUID in context setting fails with SQL 22P02', async () => {
    await failsRuntime('22P02', async (tx) => {
      await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', ['not-a-valid-uuid']);
      await tx.query('SELECT count(*)::int FROM app."CandidateProfile"');
    });
  });

  await test('context does not leak across transactions and clears after both COMMIT and ROLLBACK', async () => {
    // 1. Despeje tras COMMIT
    await db.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE equipo10_runtime');
      await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [a.user]);
    });
    await db.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE equipo10_runtime');
      const guc = await tx.query("SELECT current_setting('app.actor_user_id', true) AS val");
      assert.equal(guc.rows[0].val, '');
      const r = await tx.query('SELECT count(*)::int AS count FROM app."CandidateProfile"');
      assert.equal(r.rows[0].count, 0);
    });

    // 2. Despeje tras ROLLBACK provocado
    try {
      await db.transaction(async (tx) => {
        await tx.query('SET LOCAL ROLE equipo10_runtime');
        await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [a.user]);
        throw new Error('force_rollback');
      });
    } catch (e) {
      if (e.message !== 'force_rollback') throw e;
    }
    await db.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE equipo10_runtime');
      const guc = await tx.query("SELECT current_setting('app.actor_user_id', true) AS val");
      assert.equal(guc.rows[0].val, '');
      const r = await tx.query('SELECT count(*)::int AS count FROM app."CandidateProfile"');
      assert.equal(r.rows[0].count, 0);
    });
  });

  await test('actor A cannot insert foreign B records (fails 42501)', async () => {
    await failsRuntime('42501', async (tx) => {
      await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [a.user]);
      await tx.query('INSERT INTO app."ProfileExperience" (id, "profileId", "revisionId", kind, title, description) VALUES ($1, $2, $3, \'FORMAL\', \'Hacker\', \'Desc\')', [uid(), b.profile, b.revision]);
    });
  });

  await test('actor A cannot audit foreign revision with null profileId (fails 42501)', async () => {
    await failsRuntime('42501', async (tx) => {
      await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [a.user]);
      await tx.query('INSERT INTO app."AuditEvent" (id, "actorUserId", "profileId", "revisionId", "caseId", event, "reasonCode") VALUES ($1, $2, NULL, $3, \'test-case\', \'TEST_AUDIT\', \'FOREIGN\')', [uid(), a.user, b.revision]);
    });
  });

  await test('actor A UPDATE and DELETE on foreign B records yield 0 affected rows and leave data intact', async () => {
    await db.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE equipo10_runtime');
      await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [a.user]);

      const upd = await tx.query('UPDATE app."ProfileExperience" SET title = \'Compromised\' WHERE id = $1', [b.experience]);
      assert.equal(upd.affectedRows ?? upd.rowCount ?? 0, 0);

      const del = await tx.query('DELETE FROM app."ProfileExperience" WHERE id = $1', [b.experience]);
      assert.equal(del.affectedRows ?? del.rowCount ?? 0, 0);
    });

    // Comprobación como owner de que el registro de B sigue intacto
    const verify = await db.query('SELECT title FROM app."ProfileExperience" WHERE id = $1', [b.experience]);
    assert.equal(verify.rows[0].title, 'Experiencia Base');
  });

  await test('catalog and AppUser writes are denied for runtime role', async () => {
    await failsRuntime('42501', async (tx) => {
      await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [a.user]);
      await tx.query('INSERT INTO app."CatalogVersion" (id, code, "sourceLabel") VALUES ($1, \'C2\', \'L\')', [uid()]);
    });
    await failsRuntime('42501', async (tx) => {
      await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [a.user]);
      await tx.query('UPDATE app."AppUser" SET locale = \'en\' WHERE id = $1', [a.user]);
    });
  });

  await test('DDL, TRUNCATE and role operations are denied for runtime role', async () => {
    await failsRuntime('42501', async (tx) => {
      await tx.query('TRUNCATE TABLE app."CandidateProfile" CASCADE');
    });
    await failsRuntime('42501', async (tx) => {
      await tx.query('CREATE TABLE app."Injected" (id int)');
    });
    await failsRuntime('42501', async (tx) => {
      await tx.query('CREATE ROLE sub_hacker');
    });
  });

  await test('valid atomic profile confirmation executes successfully under equipo10_runtime RLS', async () => {
    await db.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE equipo10_runtime');
      await tx.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [a.user]);

      const sections = ['ACCOUNT','EXPERIENCE','TRAINING','INTERESTS','COMPETENCIES','AVAILABILITY','CONSTRAINTS','FINAL_REVIEW'];
      for (const section of sections) {
        await tx.query('INSERT INTO app."SectionReview" (id, "revisionId", section, decision, "contentRevision", "actorUserId") VALUES ($1, $2, $3, \'REVIEWED\', 2, $4)', [uid(), a.revision, section, a.user]);
      }
      const previewId = uid();
      await tx.query('INSERT INTO app."ProfilePreview" (id, "revisionId", "draftRevision", "snapshotDigest", "acknowledgePartialRequired", "expiresAt") VALUES ($1, $2, 2, $3, false, now() + interval \'15 minutes\')', [previewId, a.revision, digest]);
      const operationId = uid();
      await tx.query('INSERT INTO app."OperationReceipt" (id, "actorUserId", "profileId", operation, "idempotencyKey", "payloadHash", "receiptPayload") VALUES ($1, $2, $3, \'CONFIRM_PROFILE\', $4, $5, $6)', [operationId, a.user, a.profile, uid(), digest, JSON.stringify({ ok: true })]);
      await tx.query('INSERT INTO app."ProfileConfirmation" (id, "revisionId", "previewId", "operationId", "actorUserId", "acknowledgedPartial") VALUES ($1, $2, $3, $4, $5, false)', [uid(), a.revision, previewId, operationId, a.user]);
      await tx.query('INSERT INTO app."AuditEvent" (id, "actorUserId", "profileId", "revisionId", "operationId", "caseId", event, "reasonCode") VALUES ($1, $2, $3, $4, $5, \'test-case\', \'PROFILE_CONFIRMED\', \'USER_CONFIRMED\')', [uid(), a.user, a.profile, a.revision, operationId]);
      await tx.query('UPDATE app."ProfileRevision" SET status = \'CONFIRMED\', revision = revision + 1, "versionNumber" = 1, "confirmedAt" = (SELECT "confirmedAt" FROM app."ProfileConfirmation" WHERE "revisionId" = $1), "confirmedById" = $2, "snapshotDigest" = $3 WHERE id = $1', [a.revision, a.user, digest]);
      await tx.query('UPDATE app."CandidateProfile" SET "currentVersionId" = $1 WHERE id = $2', [a.revision, a.profile]);

      const check = await tx.query('SELECT status, "versionNumber" FROM app."ProfileRevision" WHERE id = $1', [a.revision]);
      assert.equal(check.rows[0].status, 'CONFIRMED');
      assert.equal(check.rows[0].versionNumber, 1);
    });
  });

  await test('isolated precheck 1: equipo10_runtime with BYPASSRLS is rejected (28000) and rolled back', async () => {
    const isoDb = new PGlite();
    try {
      await isoDb.exec(readFileSync(migrationSql, 'utf8'));
      await isoDb.exec('CREATE ROLE equipo10_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS');
      await assert.rejects(isoDb.exec(readFileSync(runtimeSql, 'utf8')), (err) => err.code === '28000');
      await isoDb.exec('ROLLBACK');
      const policies = await isoDb.query("SELECT policyname FROM pg_policies WHERE schemaname = 'app'");
      assert.equal(policies.rows.length, 0);
    } finally {
      await isoDb.close();
    }
  });

  await test('isolated precheck 2: safe role belonging to another role is rejected (28000)', async () => {
    const isoDb = new PGlite();
    try {
      await isoDb.exec(readFileSync(migrationSql, 'utf8'));
      await isoDb.exec('CREATE ROLE other_group NOLOGIN');
      await isoDb.exec('CREATE ROLE equipo10_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS IN ROLE other_group');
      await assert.rejects(isoDb.exec(readFileSync(runtimeSql, 'utf8')), (err) => err.code === '28000');
      await isoDb.exec('ROLLBACK');
    } finally {
      await isoDb.close();
    }
  });

  await test('isolated precheck 3: pre-existing app.CandidateProfile policy fails (42710) and rolls back cleanly', async () => {
    const isoDb = new PGlite();
    try {
      await isoDb.exec(readFileSync(migrationSql, 'utf8'));
      await isoDb.exec('CREATE POLICY candidate_profile_actor_owner_select ON app."CandidateProfile" FOR SELECT TO PUBLIC USING (true)');
      await assert.rejects(isoDb.exec(readFileSync(runtimeSql, 'utf8')), (err) => err.code === '42710');
      await isoDb.exec('ROLLBACK');
      const pol = await isoDb.query("SELECT policyname FROM pg_policies WHERE schemaname = 'app' AND tablename = 'CandidateProfile'");
      assert.equal(pol.rows.length, 1);
      assert.equal(pol.rows[0].policyname, 'candidate_profile_actor_owner_select');
      const role = await isoDb.query("SELECT rolname FROM pg_roles WHERE rolname = 'equipo10_runtime'");
      assert.equal(role.rows.length, 0);
    } finally {
      await isoDb.close();
    }
  });

  console.log(JSON.stringify({ result: 'passed', tests: results.length, suite: 'runtime-access-rls' }));
} catch (error) {
  failed = true;
  console.error(JSON.stringify({ result: 'failed', completed_tests: results.length, code: error.code, message: String(error.message).slice(0, 600) }));
  process.exitCode = 1;
} finally {
  await db.close();
  if (failed) process.exitCode = 1;
}
