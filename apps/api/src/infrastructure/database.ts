import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "../../../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { AppError } from "../errors";
import type { APIConfig } from "../config";

export interface IdentityDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export class Database implements IdentityDatabase {
  private pool: pg.Pool | null = null;
  private prisma: PrismaClient | null = null;
  private readonly config: APIConfig;

  constructor(config: APIConfig) {
    this.config = config;
  }

  private getClient(): PrismaClient {
    if (this.prisma) {
      return this.prisma;
    }

    const url = new URL(this.config.databaseUrl);
    url.searchParams.delete("ssl");
    url.searchParams.delete("sslmode");
    url.searchParams.delete("sslrootcert");
    url.searchParams.delete("sslcert");
    url.searchParams.delete("sslkey");
    url.searchParams.delete("sslaccept");
    url.searchParams.delete("sslnegotiation");

    let sslConfig: boolean | { ca: string; rejectUnauthorized: boolean } = false;
    if (!this.config.testDatabase && this.config.caFile) {
      const caCert = readFileSync(this.config.caFile, "utf-8");
      sslConfig = {
        ca: caCert,
        rejectUnauthorized: true,
      };
    }

    const pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: sslConfig,
      max: 5,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
    });
    this.pool = pool;

    const adapter = new PrismaPg(pool, { schema: "app", disposeExternalPool: false });
    this.prisma = new PrismaClient({ adapter });
    return this.prisma;
  }

  async resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null> {
    const client = this.getClient();
    try {
      const query = bootstrap
        ? Prisma.sql`SELECT app.bootstrap_app_user(${subject}::uuid) AS id;`
        : Prisma.sql`SELECT app.resolve_app_user(${subject}::uuid) AS id;`;
      const rows = await client.$queryRaw<{ id: string | null }[]>(query);
      if (!rows || rows.length === 0 || !rows[0].id) {
        return null;
      }
      return rows[0].id;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const meta = err.meta as { code?: string; driverAdapterError?: { cause?: { originalCode?: string; code?: string } } } | undefined;
        const sqlCode = meta?.code ?? meta?.driverAdapterError?.cause?.originalCode ?? meta?.driverAdapterError?.cause?.code;
        if (sqlCode === "42501") {
          throw new AppError(403, "OPERATION_NOT_ALLOWED", "Operación denegada o cuenta deshabilitada");
        }
      }
      if (err instanceof AppError) throw err;
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Servicio de datos no disponible temporalmente", true);
    }
  }

  async withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const client = this.getClient();
    try {
      return await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE equipo10_runtime;");
        await tx.$executeRaw(Prisma.sql`SELECT set_config('app.actor_user_id', ${id}, true);`);

        const user = await tx.appUser.findUnique({
          where: { id },
          select: { status: true },
        });

        if (!user || user.status !== "ACTIVE") {
          throw new AppError(403, "OPERATION_NOT_ALLOWED", "La cuenta del usuario no está activa");
        }

        return await fn(tx);
      });
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const meta = err.meta as { code?: string; driverAdapterError?: { cause?: { originalCode?: string; code?: string } } } | undefined;
        const sqlCode = meta?.code ?? meta?.driverAdapterError?.cause?.originalCode ?? meta?.driverAdapterError?.cause?.code;
        if (sqlCode === "42501") {
          throw new AppError(403, "OPERATION_NOT_ALLOWED", "Operación no permitida");
        }
      }
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Servicio de base de datos no disponible", true);
    }
  }

  async close(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
