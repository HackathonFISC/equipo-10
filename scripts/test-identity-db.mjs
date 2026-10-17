import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (err) {
    results.push({ name, passed: false, error: err.message, code: err.code });
  }
}

async function asRole(role, fn) {
  const allowed = ['postgres', 'equipo10_runtime', 'equipo10_api', 'anon'];
  if (!allowed.includes(role)) throw new Error(`Role ${role} not allowed`);
  return await db.transaction(async (tx) => {
    await tx.query(`SET LOCAL ROLE ${role}`);
    return await fn(tx);
  });
}

async function expectedError(role, fn, expectedCode) {
  let thrown = null;
  try {
    await asRole(role, fn);
  } catch (err) {
    thrown = err;
  }
  assert(thrown, `Expected error code ${expectedCode} but none was thrown`);
  assert.equal(thrown.code, expectedCode, `Expected code ${expectedCode}, got ${thrown.code} (${thrown.message})`);
}

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
  `);

  const p1 = 'prisma/migrations/202610160001_profile/migration.sql';
  const pRuntime = 'prisma/runtime-access.sql';
  const sql1 = fs.readFileSync(p1, 'utf8');
  const sqlRuntime = fs.readFileSync(pRuntime, 'utf8');
  await db.exec(sql1);
  await db.exec(sqlRuntime);

  await db.exec(`
    CREATE ROLE equipo10_api LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
    GRANT equipo10_runtime TO equipo10_api WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
  `);

  const p2 = 'prisma/migrations/202610160002_identity/migration.sql';
  const sql2 = fs.readFileSync(p2, 'utf8');
  await db.exec(sql2);

  await test('27 app tables have RLS enabled and 2 new policies target runtime', async () => {
    const rls = await db.query(`
      SELECT tablename, rowsecurity FROM pg_tables
      WHERE schemaname = 'app';
    `);
    assert.equal(rls.rows.length, 27);
    for (const row of rls.rows) {
      assert.equal(row.rowsecurity, true, `Table ${row.tablename} must have RLS`);
    }
    const pols = await db.query(`
      SELECT policyname, roles::text[] as roles FROM pg_policies
      WHERE schemaname = 'app' AND tablename IN ('Organization', 'OrganizationMembership');
    `);
    assert.equal(pols.rows.length, 2);
    for (const p of pols.rows) {
      assert(p.roles.includes('equipo10_runtime'), `Policy ${p.policyname} must target equipo10_runtime`);
    }
  });

  await test('only API has bootstrap/resolve EXECUTE; runtime and anon get 42501', async () => {
    const sub = crypto.randomUUID();
    await expectedError('anon', async (tx) => {
      await tx.query(`SELECT app.bootstrap_app_user('${sub}'::uuid)`);
    }, '42501');
    await expectedError('equipo10_runtime', async (tx) => {
      await tx.query(`SELECT app.bootstrap_app_user('${sub}'::uuid)`);
    }, '42501');
    await expectedError('anon', async (tx) => {
      await tx.query(`SELECT app.resolve_app_user('${sub}'::uuid)`);
    }, '42501');
    await expectedError('equipo10_runtime', async (tx) => {
      await tx.query(`SELECT app.resolve_app_user('${sub}'::uuid)`);
    }, '42501');
  });

  let userAId, userBId;
  const subA = crypto.randomUUID();
  const subB = crypto.randomUUID();

  await test('API bootstrap idempotent, distinct subjects distinct IDs, absent resolve NULL', async () => {
    await asRole('equipo10_api', async (tx) => {
      const r1 = await tx.query(`SELECT app.bootstrap_app_user('${subA}'::uuid) as id`);
      userAId = r1.rows[0].id;
      const r2 = await tx.query(`SELECT app.bootstrap_app_user('${subA}'::uuid) as id`);
      assert.equal(r2.rows[0].id, userAId, 'Same subject must yield same user ID');

      const r3 = await tx.query(`SELECT app.bootstrap_app_user('${subB}'::uuid) as id`);
      userBId = r3.rows[0].id;
      assert.notEqual(userBId, userAId, 'Different subjects must yield different IDs');

      const nonExistent = crypto.randomUUID();
      const r4 = await tx.query(`SELECT app.resolve_app_user('${nonExistent}'::uuid) as id`);
      assert.equal(r4.rows[0].id, null, 'Absent subject resolve should be NULL');
    });
  });

  await test('null auth subject raises 22004', async () => {
    await expectedError('equipo10_api', async (tx) => {
      await tx.query(`SELECT app.bootstrap_app_user(NULL)`);
    }, '22004');
    await expectedError('equipo10_api', async (tx) => {
      await tx.query(`SELECT app.resolve_app_user(NULL)`);
    }, '22004');
  });

  await test('disabled user bootstrap/resolve throws 42501 and remains DISABLED', async () => {
    const disSub = crypto.randomUUID();
    let disUserId;
    await asRole('equipo10_api', async (tx) => {
      const r = await tx.query(`SELECT app.bootstrap_app_user('${disSub}'::uuid) as id`);
      disUserId = r.rows[0].id;
    });
    await db.query(`UPDATE app."AppUser" SET "status" = 'DISABLED' WHERE "id" = '${disUserId}'`);

    await expectedError('equipo10_api', async (tx) => {
      await tx.query(`SELECT app.bootstrap_app_user('${disSub}'::uuid)`);
    }, '42501');
    await expectedError('equipo10_api', async (tx) => {
      await tx.query(`SELECT app.resolve_app_user('${disSub}'::uuid)`);
    }, '42501');

    const check = await db.query(`SELECT "status" FROM app."AppUser" WHERE "id" = '${disUserId}'`);
    assert.equal(check.rows[0].status, 'DISABLED');
  });

  await test('equipo10_api direct AppUser SELECT raises 42501', async () => {
    await expectedError('equipo10_api', async (tx) => {
      await tx.query(`SELECT * FROM app."AppUser"`);
    }, '42501');
  });

  const orgCompanyId = crypto.randomUUID();
  const orgTcId = crypto.randomUUID();
  const memAId = crypto.randomUUID();
  const memBId = crypto.randomUUID();

  await db.exec(`
    INSERT INTO app."CandidateProfile" ("id", "ownerUserId")
    VALUES ('${crypto.randomUUID()}', '${userAId}'), ('${crypto.randomUUID()}', '${userBId}');

    INSERT INTO app."Organization" ("id", "name", "type", "active", "updatedAt")
    VALUES
      ('${orgCompanyId}', 'Acme Corp', 'COMPANY', true, clock_timestamp()),
      ('${orgTcId}', 'Skill Center', 'TRAINING_CENTER', true, clock_timestamp());

    INSERT INTO app."OrganizationMembership" ("id", "userId", "organizationId", "role", "status", "updatedAt")
    VALUES
      ('${memAId}', '${userAId}', '${orgCompanyId}', 'RECRUITER', 'ACTIVE', clock_timestamp()),
      ('${memBId}', '${userBId}', '${orgTcId}', 'TRAINING_MANAGER', 'ACTIVE', clock_timestamp());
  `);

  await test('runtime sees own user/profile/membership/org only, foreign org zero, forged insert 42501', async () => {
    const actors = [
      { id: userAId, expectedOrg: orgCompanyId },
      { id: userBId, expectedOrg: orgTcId },
    ];
    for (const actor of actors) {
      await asRole('equipo10_runtime', async (tx) => {
        await tx.query(`SELECT set_config('app.actor_user_id', '${actor.id}', true)`);
        const u = await tx.query(`SELECT "id" FROM app."AppUser"`);
        assert.equal(u.rows.length, 1);
        assert.equal(u.rows[0].id, actor.id);

        const p = await tx.query(`SELECT "ownerUserId" FROM app."CandidateProfile"`);
        assert.equal(p.rows.length, 1);
        assert.equal(p.rows[0].ownerUserId, actor.id);

        const m = await tx.query(`SELECT "userId", "organizationId" FROM app."OrganizationMembership"`);
        assert.equal(m.rows.length, 1);
        assert.equal(m.rows[0].organizationId, actor.expectedOrg);

        const org = await tx.query(`SELECT "id" FROM app."Organization"`);
        assert.equal(org.rows.length, 1);
        assert.equal(org.rows[0].id, actor.expectedOrg);
      });
    }

    await expectedError('equipo10_runtime', async (tx) => {
      await tx.query(`SELECT set_config('app.actor_user_id', '${userAId}', true)`);
      await tx.query(`
        INSERT INTO app."OrganizationMembership" ("id", "userId", "organizationId", "role", "updatedAt")
        VALUES ('${crypto.randomUUID()}', '${userAId}', '${orgTcId}', 'TRAINING_MANAGER', clock_timestamp())
      `);
    }, '42501');
  });

  await test('invalid recruiter for training center and type change trigger raise 23514', async () => {
    await expectedError('postgres', async (tx) => {
      await tx.query(`
        INSERT INTO app."OrganizationMembership" ("id", "userId", "organizationId", "role", "updatedAt")
        VALUES ('${crypto.randomUUID()}', '${userAId}', '${orgTcId}', 'RECRUITER', clock_timestamp())
      `);
    }, '23514');

    await expectedError('postgres', async (tx) => {
      await tx.query(`
        UPDATE app."Organization" SET "type" = 'TRAINING_CENTER' WHERE "id" = '${orgCompanyId}'
      `);
    }, '23514');
  });

  await test('revoked membership sees zero org/membership; inactive org not visible to member', async () => {
    await db.query(`UPDATE app."OrganizationMembership" SET "status" = 'REVOKED' WHERE "id" = '${memAId}'`);
    await asRole('equipo10_runtime', async (tx) => {
      await tx.query(`SELECT set_config('app.actor_user_id', '${userAId}', true)`);
      const m = await tx.query(`SELECT * FROM app."OrganizationMembership"`);
      const org = await tx.query(`SELECT * FROM app."Organization"`);
      assert.equal(m.rows.length, 0);
      assert.equal(org.rows.length, 0);
    });
    await db.query(`UPDATE app."OrganizationMembership" SET "status" = 'ACTIVE' WHERE "id" = '${memAId}'`);

    await db.query(`UPDATE app."Organization" SET "active" = false WHERE "id" = '${orgTcId}'`);
    await asRole('equipo10_runtime', async (tx) => {
      await tx.query(`SELECT set_config('app.actor_user_id', '${userBId}', true)`);
      const m = await tx.query(`SELECT * FROM app."OrganizationMembership"`);
      const org = await tx.query(`SELECT * FROM app."Organization"`);
      assert.equal(m.rows.length, 1);
      assert.equal(org.rows.length, 0);
    });
    await db.query(`UPDATE app."Organization" SET "active" = true WHERE "id" = '${orgTcId}'`);
  });

  await test('no actor after SET ROLE sees zero rows', async () => {
    await asRole('equipo10_runtime', async (tx) => {
      const m = await tx.query(`SELECT * FROM app."OrganizationMembership"`);
      const org = await tx.query(`SELECT * FROM app."Organization"`);
      assert.equal(m.rows.length, 0);
      assert.equal(org.rows.length, 0);
    });
  });

  await test('COMMIT and ROLLBACK reset GUC and current_user back to owner', async () => {
    await asRole('equipo10_runtime', async (tx) => {
      await tx.query(`SELECT set_config('app.actor_user_id', '${userAId}', true)`);
    });
    const guc1 = await db.query(`SELECT current_setting('app.actor_user_id', true) as val, current_user as u`);
    assert.equal(guc1.rows[0].val, '');
    assert.equal(guc1.rows[0].u, 'postgres');

    try {
      await asRole('equipo10_runtime', async (tx) => {
        await tx.query(`SELECT set_config('app.actor_user_id', '${userAId}', true)`);
        throw new Error('force rollback');
      });
    } catch (_) {}
    const guc2 = await db.query(`SELECT current_setting('app.actor_user_id', true) as val, current_user as u`);
    assert.equal(guc2.rows[0].val, '');
    assert.equal(guc2.rows[0].u, 'postgres');
  });
} finally {
  await db.close();
}

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(JSON.stringify({
  total: results.length,
  passed,
  failed,
  results,
}, null, 2));
if (failed > 0) {
  process.exit(1);
}
