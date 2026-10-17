// Diagnostic only: no schema changes or credential values in output.
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const driverDirectory = process.argv[2];
  const { Client } = driverDirectory
    ? require(path.resolve(driverDirectory))
    : require('pg');
  const certificate = fs.readFileSync(
    path.resolve(process.env.DATABASE_SSL_CA_FILE || 'certs/supabase-prod-ca-2021.crt'),
    'utf8',
  );
  const results = {};
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    let client;
    try {
      if (!process.env[name]) {
        results[name] = { status: 'not_configured' };
        continue;
      }
      const url = new URL(process.env[name]);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new TypeError('Invalid database URL');
      }
      // pg connection-string SSL options can replace the explicit SSL object.
      // Use one configuration source so verification always stays enabled.
      for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation']) {
        url.searchParams.delete(key);
      }
      client = new Client({
        connectionString: url.toString(),
        connectionTimeoutMillis: 12000,
        query_timeout: 12000,
        ssl: { ca: certificate, rejectUnauthorized: true },
      });
      await client.connect();
      await client.query('BEGIN READ ONLY');
      const result = await client.query('SELECT 1 AS ok');
      const stream = client.connection.stream;
      results[name] = {
        authenticated: true,
        read_only_select_ok: result.rows[0].ok === 1,
        tls_authorized: stream.authorized === true,
        tls_protocol: stream.getProtocol(),
      };
      await client.query('ROLLBACK');
      if (!results[name].tls_authorized || !results[name].read_only_select_ok) {
        process.exitCode = 1;
      }
    } catch (error) {
      results[name] = {
        authenticated: false,
        error_type: error.name,
        // Never print raw error messages: drivers may include connection data.
        code: /^[A-Z0-9_]{1,60}$/.test(String(error.code || '')) ? error.code : null,
      };
      process.exitCode = 1;
    } finally {
      if (client) {
        try { await client.end(); } catch { process.exitCode = 1; }
      }
    }
  }
  console.log(JSON.stringify(results));
}

main().catch((error) => {
  console.log(JSON.stringify({ check_failed: true, error_type: error.name }));
  process.exitCode = 1;
});
