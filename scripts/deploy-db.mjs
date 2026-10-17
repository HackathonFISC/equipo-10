import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const { Client } = pg;

export const MIGRATION_DIR_NAME = '202610160001_profile';
export const MIGRATION_ENTRY_NAME = '202610160001_profile';
export const APP_ROLE_RUNTIME = 'equipo10_runtime';
export const APP_ROLE_API = 'equipo10_api';
export const EXPECTED_APP_TABLES_COUNT = 27;
export const EXPECTED_POLICIES_COUNT = 27;

export function sanitizeUrlForPg(rawUrl) {
  const parsed = new URL(rawUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('invalid_database_url_protocol');
  }
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation']) {
    parsed.searchParams.delete(key);
  }
  return parsed.toString();
}

export function extractProjectRefFromUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  const directMatch = parsed.hostname.match(/^db\.([a-z0-9_-]+)\.supabase\.co$/i);
  if (directMatch) return directMatch[1];
  if (parsed.hostname.toLowerCase().endsWith('.pooler.supabase.com')) {
    const user = decodeURIComponent(parsed.username || '');
    const uMatch = user.match(/\.([a-z0-9_-]+)$/i);
    if (uMatch) return uMatch[1];
  }
  return null;
}

export function validateDestinationConfig({ supabaseUrl, directUrl, databaseUrl }) {
  if (!supabaseUrl) throw new Error('missing_SUPABASE_URL');
  if (!directUrl) throw new Error('missing_DIRECT_URL');
  const supaParsed = new URL(supabaseUrl);
  if (supaParsed.protocol !== 'https:') {
    throw new Error('invalid_SUPABASE_URL_protocol_expected_https');
  }
  const supaRefMatch = supaParsed.hostname.match(/^([a-z0-9_-]+)\.supabase\.co$/i);
  if (!supaRefMatch) throw new Error('invalid_SUPABASE_URL_format');
  const expectedRef = supaRefMatch[1];

  const directParsed = new URL(directUrl);
  if (!['postgres:', 'postgresql:'].includes(directParsed.protocol)) {
    throw new Error('invalid_DIRECT_URL_protocol');
  }
  const directPort = directParsed.port || '5432';
  if (directPort !== '5432') {
    throw new Error('invalid_DIRECT_URL_port_expected_5432');
  }
  const directHostname = directParsed.hostname.toLowerCase();
  const isDirectHost = directHostname === `db.${expectedRef.toLowerCase()}.supabase.co`;
  const isPoolerHost = directHostname.endsWith('.pooler.supabase.com');
  if (!isDirectHost && !isPoolerHost) {
    throw new Error('DIRECT_URL_destination_mismatch');
  }
  const directRef = extractProjectRefFromUrl(directUrl);
  if (!directRef || directRef !== expectedRef) {
    throw new Error('DIRECT_URL_destination_mismatch');
  }
  if (isPoolerHost) {
    const directUser = decodeURIComponent(directParsed.username || '');
    const uMatch = directUser.match(/\.([a-z0-9_-]+)$/i);
    if (!uMatch || uMatch[1] !== expectedRef) {
      throw new Error('DIRECT_URL_destination_mismatch');
    }
  }

  if (databaseUrl) {
    const dbParsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(dbParsed.protocol)) {
      throw new Error('invalid_DATABASE_URL_protocol');
    }
    const dbPort = dbParsed.port || '5432';
    if (dbPort !== '5432') {
      throw new Error('invalid_DATABASE_URL_port_expected_5432');
    }
    const dbHostname = dbParsed.hostname.toLowerCase();
    const isDbDirectHost = dbHostname === `db.${expectedRef.toLowerCase()}.supabase.co`;
    const isDbPoolerHost = dbHostname.endsWith('.pooler.supabase.com');
    if (!isDbDirectHost && !isDbPoolerHost) {
      throw new Error('DATABASE_URL_host_forbidden');
    }
    const dbRef = extractProjectRefFromUrl(databaseUrl);
    if (dbRef && dbRef !== expectedRef) {
      throw new Error('DATABASE_URL_destination_mismatch');
    }
    if (isDbPoolerHost) {
      const dbUser = decodeURIComponent(dbParsed.username || '');
      const uMatch = dbUser.match(/\.([a-z0-9_-]+)$/i);
      if (!uMatch || uMatch[1] !== expectedRef) {
        throw new Error('DATABASE_URL_pooler_username_ref_mismatch');
      }
    }
  }

  return { projectRef: expectedRef };
}

export function computeMigrationChecksum(migrationSqlPath) {
  const buf = fs.readFileSync(migrationSqlPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function stripOuterTransaction(sqlText) {
  const leadingMatch = sqlText.match(/^\s*BEGIN\s*;[ \t]*(?:\r?\n|$)/i);
  if (!leadingMatch) {
    throw new Error('runtime_sql_missing_leading_BEGIN');
  }
  const trailingMatch = sqlText.match(/(?:^|\r?\n)[ \t]*COMMIT\s*;\s*$/i);
  if (!trailingMatch) {
    throw new Error('runtime_sql_missing_trailing_COMMIT');
  }
  return sqlText.slice(leadingMatch[0].length, trailingMatch.index).trim();
}

export function generateApiPassword() {
  return crypto.randomBytes(32).toString('base64url');
}

export function buildNewDatabaseUrl(existingUrl, newUsername, newPassword) {
  const parsed = new URL(existingUrl);
  parsed.username = newUsername;
  parsed.password = newPassword;
  for (const k of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation']) {
    parsed.searchParams.delete(k);
  }
  parsed.searchParams.set('sslmode', 'require');
  return parsed.toString();
}

export function replaceDatabaseUrlInEnv(envContent, newDatabaseUrl) {
  const lines = envContent.split(/(\r?\n)/);
  let matchCount = 0;
  let targetIdx = -1;
  for (let i = 0; i < lines.length; i += 2) {
    if (/^DATABASE_URL\s*=/.test(lines[i])) {
      matchCount++;
      targetIdx = i;
    }
  }
  if (matchCount === 0) {
    throw new Error('DATABASE_URL_not_found_in_env');
  }
  if (matchCount > 1) {
    throw new Error('DATABASE_URL_duplicated_in_env');
  }
  lines[targetIdx] = `DATABASE_URL="${newDatabaseUrl}"`;
  return lines.join('');
}

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

async function phaseCheck(env, caCertPath) {
  validateDestinationConfig({
    supabaseUrl: env.SUPABASE_URL,
    directUrl: env.DIRECT_URL,
    databaseUrl: env.DATABASE_URL,
  });

  const client = await createPgClient(env.DIRECT_URL, caCertPath);
  try {
    await client.query('BEGIN READ ONLY');
    const verRes = await client.query('SELECT current_database() AS db, current_user AS cu, version() AS ver');
    const roleRes = await client.query(
      'SELECT rolname, rolcanlogin, rolsuper, rolcreaterole FROM pg_roles WHERE rolname = ANY($1)',
      [[APP_ROLE_RUNTIME, APP_ROLE_API]]
    );
    const appSchemaRes = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'app') AS exists");
    const publicTablesRes = await client.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    const prismaHistoryRes = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations') AS exists"
    );
    await client.query('ROLLBACK');

    const report = {
      database: verRes.rows[0].db,
      connected_user: verRes.rows[0].cu,
      app_schema_exists: appSchemaRes.rows[0].exists,
      public_tables_count: publicTablesRes.rows[0].count,
      prisma_history_exists: prismaHistoryRes.rows[0].exists,
      roles_found: roleRes.rows.map((r) => r.rolname),
      status: 'check_complete',
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    await client.end().catch(() => {});
  }
}

async function phaseMigrate(env, caCertPath, cwd) {
  validateDestinationConfig({
    supabaseUrl: env.SUPABASE_URL,
    directUrl: env.DIRECT_URL,
    databaseUrl: env.DATABASE_URL,
  });

  const preClient = await createPgClient(env.DIRECT_URL, caCertPath);
  try {
    await preClient.query('BEGIN READ ONLY');
    const appSchema = await preClient.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = 'app'");
    const publicTables = await preClient.query("SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
    const prismaTbl = await preClient.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations'");
    const roles = await preClient.query('SELECT 1 FROM pg_roles WHERE rolname = ANY($1)', [[APP_ROLE_RUNTIME, APP_ROLE_API]]);
    await preClient.query('ROLLBACK');

    if (appSchema.rows.length > 0 || publicTables.rows[0].cnt > 0 || prismaTbl.rows.length > 0 || roles.rows.length > 0) {
      throw new Error('migrate_preflight_failed_database_not_fresh');
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
    timeout: 60000,
  });

  if (res.status !== 0) {
    const errOut = (res.stderr || '') + (res.stdout || '');
    const prismaErrMatch = errOut.match(/\b(P\d{4})\b/);
    throw new Error(`prisma_migrate_deploy_failed_${prismaErrMatch ? prismaErrMatch[1] : 'UNKNOWN'}`);
  }

  const postClient = await createPgClient(env.DIRECT_URL, caCertPath);
  let tablesCount = 0;
  try {
    const tablesRes = await postClient.query("SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_schema = 'app' AND table_type = 'BASE TABLE'");
    tablesCount = tablesRes.rows[0].cnt;
    if (tablesCount !== EXPECTED_APP_TABLES_COUNT) {
      throw new Error(`unexpected_app_tables_count_post_migration_${tablesCount}`);
    }
  } finally {
    await postClient.end().catch(() => {});
  }

  const summary = {
    status: 'migrate_success',
    app_tables_created: tablesCount,
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function phaseRuntime(env, caCertPath, cwd) {
  validateDestinationConfig({
    supabaseUrl: env.SUPABASE_URL,
    directUrl: env.DIRECT_URL,
    databaseUrl: env.DATABASE_URL,
  });

  const pendingPath = path.resolve(cwd, '.env.runtime.pending');
  if (fs.existsSync(pendingPath)) {
    throw new Error('pending_runtime_mutation_already_exists_run_recovery_or_inspect');
  }

  const migrationSqlPath = path.resolve(cwd, 'prisma/migrations', MIGRATION_DIR_NAME, 'migration.sql');
  if (!fs.existsSync(migrationSqlPath)) {
    throw new Error('migration_sql_file_not_found');
  }
  const expectedChecksum = computeMigrationChecksum(migrationSqlPath);

  const runtimeSqlPath = path.resolve(cwd, 'prisma/runtime-access.sql');
  if (!fs.existsSync(runtimeSqlPath)) {
    throw new Error('runtime_access_sql_file_not_found');
  }
  const rawRuntimeSql = fs.readFileSync(runtimeSqlPath, 'utf8');
  const innerRuntimeSql = stripOuterTransaction(rawRuntimeSql);

  const client = await createPgClient(env.DIRECT_URL, caCertPath);
  let apiPassword = null;
  let newDatabaseUrl = null;
  let backupPath = null;

  try {
    const migCheck = await client.query(
      'SELECT checksum, finished_at, rolled_back_at FROM public._prisma_migrations WHERE migration_name = $1',
      [MIGRATION_ENTRY_NAME]
    );
    if (migCheck.rows.length !== 1) {
      throw new Error('prisma_migration_entry_not_found');
    }
    const row = migCheck.rows[0];
    if (row.checksum !== expectedChecksum) {
      throw new Error('prisma_migration_checksum_mismatch');
    }
    if (!row.finished_at || row.rolled_back_at) {
      throw new Error('prisma_migration_not_cleanly_finished');
    }

    const appTables = await client.query("SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_schema = 'app' AND table_type = 'BASE TABLE'");
    if (appTables.rows[0].cnt !== EXPECTED_APP_TABLES_COUNT) {
      throw new Error('app_tables_count_mismatch');
    }

    const rolesCheck = await client.query('SELECT rolname FROM pg_roles WHERE rolname = ANY($1)', [[APP_ROLE_API, APP_ROLE_RUNTIME]]);
    if (rolesCheck.rows.some((r) => r.rolname === APP_ROLE_API)) {
      throw new Error('api_role_already_exists');
    }

    const policiesCheck = await client.query("SELECT count(*)::int AS cnt FROM pg_policies WHERE schemaname = 'app'");
    if (policiesCheck.rows[0].cnt > 0) {
      throw new Error('runtime_policies_already_exist');
    }

    apiPassword = generateApiPassword();
    const projectRef = extractProjectRefFromUrl(env.DIRECT_URL);
    const baseUrl = env.DATABASE_URL || env.DIRECT_URL;
    const parsedBase = new URL(baseUrl);
    const dbUsername = parsedBase.hostname.toLowerCase().endsWith('.pooler.supabase.com')
      ? `${APP_ROLE_API}.${projectRef}`
      : APP_ROLE_API;

    newDatabaseUrl = buildNewDatabaseUrl(baseUrl, dbUsername, apiPassword);

    const envPath = path.resolve(cwd, '.env');
    const currentEnvRaw = fs.readFileSync(envPath, 'utf8');
    const updatedEnvRaw = replaceDatabaseUrlInEnv(currentEnvRaw, newDatabaseUrl);

    fs.writeFileSync(pendingPath, `DATABASE_URL="${newDatabaseUrl}"\n`, { mode: 0o600, flag: 'wx' });

    const timestamp = Date.now();
    backupPath = path.resolve(cwd, `.env.pre-runtime-${timestamp}`);
    fs.writeFileSync(backupPath, currentEnvRaw, { mode: 0o600, flag: 'wx' });

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(9182736451029384)');

    await client.query(innerRuntimeSql);

    const createRoleSql = `CREATE ROLE ${APP_ROLE_API} WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER NOBYPASSRLS NOREPLICATION PASSWORD '${apiPassword}';`;
    await client.query(createRoleSql);

    const dbNameRes = await client.query('SELECT current_database() AS db');
    const currentDbIdent = dbNameRes.rows[0].db.replace(/"/g, '""');
    await client.query(`GRANT CONNECT ON DATABASE "${currentDbIdent}" TO ${APP_ROLE_API};`);
    await client.query(`GRANT ${APP_ROLE_RUNTIME} TO ${APP_ROLE_API} WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`);

    await client.query('COMMIT');

    let loginSuccess = false;
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let testClient = null;
      try {
        testClient = await createPgClient(newDatabaseUrl, caCertPath);
        const ping = await testClient.query('SELECT current_user AS cu');
        if (ping.rows[0].cu === APP_ROLE_API) {
          loginSuccess = true;
          break;
        }
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 2000));
      } finally {
        if (testClient) await testClient.end().catch(() => {});
      }
    }

    if (!loginSuccess) {
      throw new Error(`api_role_login_verification_failed_${lastErr ? lastErr.name : 'timeout'}`);
    }

    const envCheckRaw = fs.readFileSync(envPath, 'utf8');
    if (Buffer.compare(Buffer.from(envCheckRaw), Buffer.from(currentEnvRaw)) !== 0) {
      throw new Error('concurrent_env_mutation_detected');
    }
    const tmpEnvPath = path.resolve(cwd, '.env.runtime.tmp');
    fs.writeFileSync(tmpEnvPath, updatedEnvRaw, { mode: 0o600, flag: 'wx' });
    fs.renameSync(tmpEnvPath, envPath);
    if (fs.existsSync(pendingPath)) {
      fs.unlinkSync(pendingPath);
    }

    const report = {
      status: 'runtime_provisioned_and_env_updated',
      api_role: APP_ROLE_API,
      runtime_role: APP_ROLE_RUNTIME,
      verified_login: true,
      backup_env: path.basename(backupPath),
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

async function phaseVerify(env, caCertPath, cwd) {
  validateDestinationConfig({
    supabaseUrl: env.SUPABASE_URL,
    directUrl: env.DIRECT_URL,
    databaseUrl: env.DATABASE_URL,
  });

  const migrationSqlPath = path.resolve(cwd, 'prisma/migrations', MIGRATION_DIR_NAME, 'migration.sql');
  if (!fs.existsSync(migrationSqlPath)) {
    throw new Error('migration_sql_file_not_found');
  }
  const expectedChecksum = computeMigrationChecksum(migrationSqlPath);

  const adminClient = await createPgClient(env.DIRECT_URL, caCertPath);
  try {
    const migCheck = await adminClient.query(
      'SELECT checksum, finished_at, rolled_back_at FROM public._prisma_migrations WHERE migration_name = $1',
      [MIGRATION_ENTRY_NAME]
    );
    if (migCheck.rows.length !== 1 || !migCheck.rows[0].finished_at || migCheck.rows[0].rolled_back_at) {
      throw new Error('migration_status_invalid');
    }
    if (migCheck.rows[0].checksum !== expectedChecksum) {
      throw new Error('prisma_migration_checksum_mismatch');
    }

    const tblCount = await adminClient.query("SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_schema = 'app' AND table_type = 'BASE TABLE'");
    if (tblCount.rows[0].cnt !== EXPECTED_APP_TABLES_COUNT) {
      throw new Error('app_tables_count_mismatch');
    }

    const perTableCheck = await adminClient.query(`
      SELECT c.relname AS tablename, c.relrowsecurity AS rls_enabled, count(p.policyname)::int AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
      WHERE n.nspname = 'app' AND c.relkind = 'r'
      GROUP BY c.relname, c.relrowsecurity;
    `);
    if (perTableCheck.rows.length !== EXPECTED_APP_TABLES_COUNT) {
      throw new Error('app_tables_count_mismatch');
    }
    for (const row of perTableCheck.rows) {
      if (!row.rls_enabled) throw new Error(`rls_not_enabled_on_table_${row.tablename}`);
      if (row.policy_count < 1) throw new Error(`table_missing_policies_${row.tablename}`);
    }

    const badPol = await adminClient.query(
      "SELECT policyname, tablename, roles FROM pg_policies WHERE schemaname = 'app' AND NOT (roles = ARRAY[$1]::name[])",
      [APP_ROLE_RUNTIME]
    );
    if (badPol.rows.length > 0) {
      throw new Error('policies_target_role_mismatch');
    }

    const roleAttrs = await adminClient.query(
      'SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls, rolinherit FROM pg_roles WHERE rolname = ANY($1)',
      [[APP_ROLE_RUNTIME, APP_ROLE_API]]
    );
    const runtimeRole = roleAttrs.rows.find((r) => r.rolname === APP_ROLE_RUNTIME);
    const apiRole = roleAttrs.rows.find((r) => r.rolname === APP_ROLE_API);
    if (!runtimeRole || runtimeRole.rolcanlogin || runtimeRole.rolinherit || runtimeRole.rolsuper || runtimeRole.rolcreatedb || runtimeRole.rolcreaterole || runtimeRole.rolreplication || runtimeRole.rolbypassrls) {
      throw new Error('runtime_role_privileges_unsafe');
    }
    if (!apiRole || !apiRole.rolcanlogin || apiRole.rolinherit || apiRole.rolsuper || apiRole.rolcreatedb || apiRole.rolcreaterole || apiRole.rolreplication || apiRole.rolbypassrls) {
      throw new Error('api_role_privileges_unsafe');
    }

    const memRes = await adminClient.query(`
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
    const apiMemberships = memRes.rows.filter((m) => m.member_role === APP_ROLE_API);
    if (apiMemberships.length !== 1) {
      throw new Error('api_role_memberships_count_invalid');
    }
    const directMembership = apiMemberships[0];
    if (
      directMembership.parent_role !== APP_ROLE_RUNTIME ||
      directMembership.admin_option !== false ||
      directMembership.inherit_option !== false ||
      directMembership.set_option !== true
    ) {
      throw new Error('api_to_runtime_membership_options_invalid');
    }

    const ownedObjects = await adminClient.query(`
      SELECT 1 FROM pg_tables WHERE schemaname = 'app' AND tableowner = ANY($1)
      UNION ALL
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'app' AND pg_get_userbyid(p.proowner) = ANY($1)
      UNION ALL
      SELECT 1 FROM pg_namespace WHERE nspname = 'app' AND pg_get_userbyid(nspowner) = ANY($1);
    `, [[APP_ROLE_RUNTIME, APP_ROLE_API]]);
    if (ownedObjects.rows.length > 0) {
      throw new Error('forbidden_object_ownership_by_runtime_or_api_roles');
    }
  } finally {
    await adminClient.end().catch(() => {});
  }

  const apiClient = await createPgClient(env.DATABASE_URL, caCertPath);
  const actorA = crypto.randomUUID();
  const actorB = crypto.randomUUID();
  const fixtureProfileA = crypto.randomUUID();
  const fixtureProfileB = crypto.randomUUID();
  const fixtureRevA = crypto.randomUUID();
  const fixtureRevB = crypto.randomUUID();

  try {
    const whoami = await apiClient.query('SELECT current_user AS cu');
    if (whoami.rows[0].cu !== APP_ROLE_API) {
      throw new Error(`expected_api_role_login_got_${whoami.rows[0].cu}`);
    }

    let blockedDirect = false;
    try {
      await apiClient.query('SELECT count(*) FROM app."CandidateProfile"');
    } catch (e) {
      if (e.code === '42501') blockedDirect = true;
    }
    if (!blockedDirect) {
      throw new Error('api_role_should_not_have_direct_table_access_without_set_role');
    }

    await apiClient.query('BEGIN');
    await apiClient.query(`SET LOCAL ROLE ${APP_ROLE_RUNTIME};`);
    const noActorRows = await apiClient.query('SELECT count(*)::int AS cnt FROM app."CandidateProfile"');
    if (noActorRows.rows[0].cnt !== 0) {
      throw new Error('expected_zero_rows_without_actor_set');
    }
    await apiClient.query("SELECT set_config('app.actor_user_id', $1, true)", [actorA]);
    const noRows = await apiClient.query('SELECT count(*)::int AS cnt FROM app."CandidateProfile"');
    if (noRows.rows[0].cnt !== 0) {
      throw new Error('expected_zero_rows_for_fresh_actor');
    }
    await apiClient.query('ROLLBACK');

    await apiClient.query('BEGIN');
    const contextClearedCheck = await apiClient.query("SELECT current_setting('app.actor_user_id', true) AS a, current_user AS cu");
    if (contextClearedCheck.rows[0].a || contextClearedCheck.rows[0].cu !== APP_ROLE_API) {
      throw new Error('transaction_context_leakage_detected');
    }
    await apiClient.query('ROLLBACK');

    const ownerClient = await createPgClient(env.DIRECT_URL, caCertPath);
    try {
      const now = new Date();
      await ownerClient.query('BEGIN');
      await ownerClient.query('INSERT INTO app."AppUser" (id, "authSubject", "updatedAt", status) VALUES ($1, $2, $3, $4)', [actorA, crypto.randomUUID(), now, 'ACTIVE']);
      await ownerClient.query('INSERT INTO app."AppUser" (id, "authSubject", "updatedAt", status) VALUES ($1, $2, $3, $4)', [actorB, crypto.randomUUID(), now, 'ACTIVE']);
      await ownerClient.query('INSERT INTO app."CandidateProfile" (id, "ownerUserId") VALUES ($1, $2)', [fixtureProfileA, actorA]);
      await ownerClient.query('INSERT INTO app."CandidateProfile" (id, "ownerUserId") VALUES ($1, $2)', [fixtureProfileB, actorB]);
      await ownerClient.query('INSERT INTO app."ProfileRevision" (id, "profileId", "displayName", "updatedAt", status) VALUES ($1, $2, $3, $4, $5)', [fixtureRevA, fixtureProfileA, 'Actor A Draft', now, 'DRAFT']);
      await ownerClient.query('INSERT INTO app."ProfileRevision" (id, "profileId", "displayName", "updatedAt", status) VALUES ($1, $2, $3, $4, $5)', [fixtureRevB, fixtureProfileB, 'Actor B Draft', now, 'DRAFT']);

      const cuRes = await ownerClient.query('SELECT current_user AS cu');
      const quotedOwner = `"${cuRes.rows[0].cu.replace(/"/g, '""')}"`;
      await ownerClient.query(`GRANT ${APP_ROLE_RUNTIME} TO ${quotedOwner} WITH INHERIT FALSE, SET TRUE;`);
      await ownerClient.query(`SET LOCAL ROLE ${APP_ROLE_RUNTIME};`);
      await ownerClient.query("SELECT set_config('app.actor_user_id', $1, true)", [actorA]);
      const selA = await ownerClient.query('SELECT id FROM app."CandidateProfile"');
      if (selA.rows.length !== 1 || selA.rows[0].id !== fixtureProfileA) {
        throw new Error('rls_isolation_violation_actorA');
      }

      await ownerClient.query("SELECT set_config('app.actor_user_id', $1, true)", [actorB]);
      const selB = await ownerClient.query('SELECT id FROM app."CandidateProfile"');
      if (selB.rows.length !== 1 || selB.rows[0].id !== fixtureProfileB) {
        throw new Error('rls_isolation_violation_actorB');
      }
    } finally {
      await ownerClient.query('ROLLBACK').catch(() => {});
      const cleanupCheck = await ownerClient.query('SELECT count(*)::int AS cnt FROM app."AppUser" WHERE id = ANY($1)', [[actorA, actorB]]);
      if (cleanupCheck.rows[0].cnt !== 0) {
        throw new Error('fixtures_persisted_after_rollback');
      }
      await ownerClient.end().catch(() => {});
    }

    const report = {
      status: 'verify_success',
      migration_verified: true,
      app_tables_verified: EXPECTED_APP_TABLES_COUNT,
      rls_tables_verified: EXPECTED_APP_TABLES_COUNT,
      policies_verified: EXPECTED_POLICIES_COUNT,
      rls_isolation_verified: true,
      zero_persistent_seed: true,
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    await apiClient.end().catch(() => {});
  }
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
    await phaseCheck(env, caCertPath);
  } else if (flag === '--migrate') {
    const d1Path = path.resolve(cwd, 'prisma/migrations/202610160002_identity/migration.sql');
    if (fs.existsSync(d1Path)) {
      throw new Error('initial_setup_archived_use_d1_upgrade');
    }
    await phaseMigrate(env, caCertPath, cwd);
  } else if (flag === '--runtime') {
    const d1Path = path.resolve(cwd, 'prisma/migrations/202610160002_identity/migration.sql');
    if (fs.existsSync(d1Path)) {
      throw new Error('initial_setup_archived_use_d1_upgrade');
    }
    await phaseRuntime(env, caCertPath, cwd);
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
