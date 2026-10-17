import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import {
  validateDestinationConfig,
  sanitizeUrlForPg,
  computeMigrationChecksum,
  APP_ROLE_RUNTIME,
  APP_ROLE_API,
} from './deploy-db.mjs';

const { Client } = pg;

export const INITIAL_MIGRATION = '202610160001_profile';
export const D1_MIGRATION = '202610160002_identity';
export const EXPECTED_IDENTITY_FUNCTIONS = [
  'bootstrap_app_user',
  'resolve_app_user',
];

async function createPgClient(url, caCertPath) {
  const cleanUrl = sanitizeUrlForPg(url);
  const ca = fs.readFileSync(caCertPath, 'utf8');
  const client = new Client({
    connectionString: cleanUrl,
    connectionTimeoutMillis: 8000,
    query_timeout: 15000,
    ssl: { ca, rejectUnauthorized: true },
  });
  try {
    await client.connect();
  } catch (err) {
    await client.end().catch(() => {});
    throw err;
  }
  return client;
}

async function getMigrationChecksums(cwd) {
  const p1 = path.resolve(cwd, 'prisma/migrations', INITIAL_MIGRATION, 'migration.sql');
  const p2 = path.resolve(cwd, 'prisma/migrations', D1_MIGRATION, 'migration.sql');
  if (!fs.existsSync(p1) || !fs.existsSync(p2)) {
    throw new Error('migration_sql_file_not_found');
  }
  return {
    initialChecksum: computeMigrationChecksum(p1),
    d1Checksum: computeMigrationChecksum(p2),
  };
}

export async function inspectDatabase(client, expectedChecksums) {
  await client.query('BEGIN READ ONLY');
  try {
    const pTbl = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations') AS exists"
    );
    if (!pTbl.rows[0].exists) {
      throw new Error('prisma_migrations_table_missing');
    }

    const migRes = await client.query(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at ASC'
    );
    const rows = migRes.rows;
    const initRow = rows.find((r) => r.migration_name === INITIAL_MIGRATION);
    if (!initRow || !initRow.finished_at || initRow.rolled_back_at || initRow.checksum !== expectedChecksums.initialChecksum) {
      throw new Error('initial_migration_not_clean');
    }

    const d1Row = rows.find((r) => r.migration_name === D1_MIGRATION);
    const isD1Applied = Boolean(d1Row && d1Row.finished_at && !d1Row.rolled_back_at && d1Row.checksum === expectedChecksums.d1Checksum);

    const appTablesRes = await client.query(
      "SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_schema = 'app' AND table_type = 'BASE TABLE'"
    );
    const appTablesCount = appTablesRes.rows[0].cnt;

    const rlsRes = await client.query(`
      SELECT c.relname, c.relrowsecurity AS rls_enabled, count(p.policyname)::int AS policy_count,
             bool_and(p.roles = ARRAY['equipo10_runtime']::name[]) AS policy_roles_valid
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
      WHERE n.nspname = 'app' AND c.relkind = 'r'
      GROUP BY c.relname, c.relrowsecurity;
    `);

    const rolesRes = await client.query(
      'SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls, rolinherit FROM pg_roles WHERE rolname = ANY($1)',
      [[APP_ROLE_RUNTIME, APP_ROLE_API]]
    );
    const runtimeRole = rolesRes.rows.find((r) => r.rolname === APP_ROLE_RUNTIME);
    const apiRole = rolesRes.rows.find((r) => r.rolname === APP_ROLE_API);

    if (!runtimeRole || runtimeRole.rolcanlogin || runtimeRole.rolinherit || runtimeRole.rolsuper || runtimeRole.rolcreatedb || runtimeRole.rolcreaterole || runtimeRole.rolreplication || runtimeRole.rolbypassrls) {
      throw new Error('runtime_role_privileges_unsafe');
    }
    if (!apiRole || !apiRole.rolcanlogin || apiRole.rolinherit || apiRole.rolsuper || apiRole.rolcreatedb || apiRole.rolcreaterole || apiRole.rolreplication || apiRole.rolbypassrls) {
      throw new Error('api_role_privileges_unsafe');
    }

    const memRes = await client.query(`
      SELECT r_parent.rolname AS parent_role, r_member.rolname AS member_role,
             m.admin_option, m.inherit_option, m.set_option
      FROM pg_auth_members m
      JOIN pg_roles r_parent ON r_parent.oid = m.roleid
      JOIN pg_roles r_member ON r_member.oid = m.member
      WHERE r_parent.rolname = ANY($1) OR r_member.rolname = ANY($1);
    `, [[APP_ROLE_RUNTIME, APP_ROLE_API]]);

    if (memRes.rows.some((m) => m.member_role === APP_ROLE_RUNTIME)) {
      throw new Error('runtime_role_forbidden_parent_membership');
    }
    const apiMem = memRes.rows.filter((m) => m.member_role === APP_ROLE_API);
    if (apiMem.length !== 1 || apiMem[0].parent_role !== APP_ROLE_RUNTIME || apiMem[0].admin_option !== false || apiMem[0].inherit_option !== false || apiMem[0].set_option !== true) {
      throw new Error('api_to_runtime_membership_options_invalid');
    }

    const ownedObjects = await client.query(`
      SELECT 1 FROM pg_tables WHERE schemaname = 'app' AND tableowner = ANY($1)
      UNION ALL
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'app' AND pg_get_userbyid(p.proowner) = ANY($1)
      UNION ALL
      SELECT 1 FROM pg_namespace WHERE nspname = 'app' AND pg_get_userbyid(nspowner) = ANY($1);
    `, [[APP_ROLE_RUNTIME, APP_ROLE_API]]);
    if (ownedObjects.rows.length > 0) {
      throw new Error('forbidden_object_ownership_by_runtime_or_api_roles');
    }

    let functionsOk = false;
    if (isD1Applied) {
      const funcRes = await client.query(`
        SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS owner,
               has_function_privilege($1, p.oid, 'EXECUTE') AS api_execute,
               has_function_privilege($2, p.oid, 'EXECUTE') AS runtime_execute,
               has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
               has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_execute
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'app' AND p.proname = ANY($3);
      `, [APP_ROLE_API, APP_ROLE_RUNTIME, EXPECTED_IDENTITY_FUNCTIONS]);

      if (funcRes.rows.length !== EXPECTED_IDENTITY_FUNCTIONS.length) {
        throw new Error('identity_functions_missing');
      }
      for (const fn of funcRes.rows) {
        if (!fn.prosecdef) throw new Error(`function_not_security_definer_${fn.proname}`);
        const searchPathSetting = (fn.proconfig || []).find((c) => c.startsWith('search_path='));
        if (searchPathSetting !== 'search_path=pg_catalog, app') {
          throw new Error(`function_search_path_invalid_${fn.proname}`);
        }
        if ([APP_ROLE_RUNTIME, APP_ROLE_API].includes(fn.owner)) {
          throw new Error(`forbidden_function_owner_${fn.proname}`);
        }
        if (!fn.api_execute || fn.runtime_execute || fn.anon_execute || fn.auth_execute) {
          throw new Error(`function_acl_invalid_${fn.proname}`);
        }
      }
      functionsOk = true;
    }

    return {
      history_count: rows.length,
      initial_applied: true,
      d1_applied: isD1Applied,
      app_tables_count: appTablesCount,
      rls_tables_count: rlsRes.rows.filter((r) => r.rls_enabled).length,
      total_policies: rlsRes.rows.reduce((acc, r) => acc + r.policy_count, 0),
      policies_verified: rlsRes.rows.length === appTablesCount && rlsRes.rows.every((r) => r.rls_enabled && r.policy_count === 1 && r.policy_roles_valid === true),
      functions_verified: functionsOk,
    };
  } finally {
    await client.query('ROLLBACK').catch(() => {});
  }
}

async function phaseCheck(env, caCertPath, cwd) {
  validateDestinationConfig({
    supabaseUrl: env.SUPABASE_URL,
    directUrl: env.DIRECT_URL,
    databaseUrl: env.DATABASE_URL,
  });
  const checksums = await getMigrationChecksums(cwd);
  const client = await createPgClient(env.DIRECT_URL, caCertPath);
  try {
    const info = await inspectDatabase(client, checksums);
    const report = {
      status: 'check_complete',
      initial_migration_clean: info.initial_applied,
      d1_migration_applied: info.d1_applied,
      app_tables_count: info.app_tables_count,
      rls_tables_count: info.rls_tables_count,
      policies_count: info.total_policies,
      functions_verified: info.functions_verified,
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    await client.end().catch(() => {});
  }
}

async function phaseApply(env, caCertPath, cwd) {
  validateDestinationConfig({
    supabaseUrl: env.SUPABASE_URL,
    directUrl: env.DIRECT_URL,
    databaseUrl: env.DATABASE_URL,
  });
  const checksums = await getMigrationChecksums(cwd);
  const preClient = await createPgClient(env.DIRECT_URL, caCertPath);
  try {
    const preInfo = await inspectDatabase(preClient, checksums);
    if (preInfo.d1_applied) {
      if (preInfo.history_count === 2 && preInfo.app_tables_count === 27 && preInfo.total_policies === 27 && preInfo.policies_verified && preInfo.functions_verified) {
        const report = { status: 'already_applied', app_tables_count: 27, policies_count: 27 };
        console.log(JSON.stringify(report, null, 2));
        return report;
      }
      throw new Error('d1_already_applied_but_postconditions_inconsistent');
    }
    if (preInfo.history_count !== 1 || preInfo.app_tables_count !== 25 || preInfo.total_policies !== 25 || !preInfo.policies_verified) {
      throw new Error('apply_preflight_failed_database_state_unexpected');
    }
  } finally {
    await preClient.end().catch(() => {});
  }

  const directParsed = new URL(env.DIRECT_URL);
  for (const k of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation', 'schema']) {
    directParsed.searchParams.delete(k);
  }
  directParsed.searchParams.set('sslmode', 'require');
  directParsed.searchParams.set('sslaccept', 'strict');
  directParsed.searchParams.set('sslcert', path.resolve(cwd, caCertPath));
  directParsed.searchParams.set('schema', 'public');

  const clonedEnv = { ...process.env, ...env, DIRECT_URL: directParsed.toString(), DATABASE_URL: directParsed.toString() };
  const prismaCli = path.resolve(cwd, 'node_modules/prisma/build/index.js');
  if (!fs.existsSync(prismaCli)) {
    throw new Error('prisma_cli_not_found_in_node_modules');
  }

  const res = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd,
    env: clonedEnv,
    encoding: 'utf8',
    timeout: 90000,
  });

  if (res.status !== 0) {
    const errOut = (res.stderr || '') + (res.stdout || '');
    const prismaErrMatch = errOut.match(/\b(P\d{4})\b/);
    throw new Error(`prisma_migrate_deploy_failed_${prismaErrMatch ? prismaErrMatch[1] : 'UNKNOWN'}`);
  }

  const postClient = await createPgClient(env.DIRECT_URL, caCertPath);
  try {
    const postInfo = await inspectDatabase(postClient, checksums);
    if (postInfo.history_count !== 2 || !postInfo.d1_applied || postInfo.app_tables_count !== 27 || postInfo.rls_tables_count !== 27 || postInfo.total_policies !== 27 || !postInfo.policies_verified || !postInfo.functions_verified) {
      throw new Error('apply_postflight_verification_failed');
    }
    const summary = {
      status: 'apply_success',
      app_tables_count: postInfo.app_tables_count,
      rls_tables_count: postInfo.rls_tables_count,
      policies_count: postInfo.total_policies,
      functions_verified: true,
    };
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  } finally {
    await postClient.end().catch(() => {});
  }
}

async function phaseVerify(env, caCertPath, cwd) {
  validateDestinationConfig({
    supabaseUrl: env.SUPABASE_URL,
    directUrl: env.DIRECT_URL,
    databaseUrl: env.DATABASE_URL,
  });
  const checksums = await getMigrationChecksums(cwd);
  const metaClient = await createPgClient(env.DIRECT_URL, caCertPath);
  let info;
  try {
    info = await inspectDatabase(metaClient, checksums);
    if (info.history_count !== 2 || !info.d1_applied || info.app_tables_count !== 27 || info.rls_tables_count !== 27 || info.total_policies !== 27 || !info.policies_verified || !info.functions_verified) {
      throw new Error('verify_precheck_failed_d1_not_fully_applied');
    }
  } finally {
    await metaClient.end().catch(() => {});
  }

  const legacyScript = path.resolve(cwd, 'scripts/deploy-db.mjs');
  const res = spawnSync(process.execPath, [legacyScript, '--verify'], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30000,
  });

  if (res.status !== 0) {
    throw new Error('legacy_verify_child_failed');
  }

  let legacyReport;
  try {
    legacyReport = JSON.parse(res.stdout);
  } catch {
    throw new Error('legacy_verify_output_parse_error');
  }

  if (legacyReport.status !== 'verify_success' || legacyReport.rls_isolation_verified !== true || legacyReport.zero_persistent_seed !== true) {
    throw new Error('legacy_verify_postconditions_failed');
  }

  const report = {
    status: 'd1_verify_success',
    app_tables_verified: info.app_tables_count,
    rls_tables_verified: info.rls_tables_count,
    policies_verified: info.total_policies,
    functions_verified: true,
    active_isolation_probe: legacyReport.rls_isolation_verified === true,
    zero_persistent_seed: legacyReport.zero_persistent_seed === true,
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

export async function main() {
  const flag = process.argv[2] || '--check';
  const cwd = process.cwd();
  const caCertPath = process.env.DATABASE_SSL_CA_FILE || path.resolve(cwd, 'certs/supabase-prod-ca-2021.crt');
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  };

  if (flag === '--check') {
    await phaseCheck(env, caCertPath, cwd);
  } else if (flag === '--apply') {
    await phaseApply(env, caCertPath, cwd);
  } else if (flag === '--verify') {
    await phaseVerify(env, caCertPath, cwd);
  } else {
    throw new Error(`unknown_flag_${flag}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    const sanitized = {
      error_name: err.name,
      message_code: /^[A-Za-z0-9_:-]{1,80}$/.test(err.message) ? err.message : 'internal_error',
    };
    if (typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) {
      sanitized.sqlstate = err.code;
    }
    console.error(JSON.stringify(sanitized));
    process.exit(1);
  });
}
