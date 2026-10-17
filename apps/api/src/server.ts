import { readConfig } from "./config";
import { Database } from "./infrastructure/database";
import { createVerifyToken } from "./security/auth";
import { IdentityService } from "./modules/identity/identity.service";
import { createApp } from "./app";

async function main() {
  let db: Database | null = null;
  try {
    const config = readConfig(process.env);
    db = new Database(config);
    const verifyToken = createVerifyToken(config);
    const identityService = new IdentityService(db);

    const app = createApp({
      identityService,
      verifyToken,
      allowedOrigins: config.allowedOrigins,
    });

    const server = Bun.serve({
      port: config.port,
      hostname: config.host,
      maxRequestBodySize: 4096,
      fetch: app.fetch,
    });

    const shutdown = async () => {
      server.stop();
      if (db) {
        await db.close();
      }
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err: unknown) {
    const className = (err as Error)?.name ?? "Error";
    const code = (err as { code?: string })?.code ?? "STARTUP_ERROR";
    console.error(`API startup failure: [${className}] ${code}`);
    if (db) {
      await db.close().catch(() => {});
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
