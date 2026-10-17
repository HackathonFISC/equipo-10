import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "../../../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { AppError } from "../errors";
import type { APIConfig } from "../config";

export interface ActorTransactionOptions { timeout?: number; maxWait?: number }

export interface IdentityDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
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

  async withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T> {
    const client = this.getClient();
    const effectiveOptions: ActorTransactionOptions = {
      timeout: options?.timeout ?? 30000,
      maxWait: options?.maxWait ?? 8000,
    };
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
      }, effectiveOptions);
    } catch (err: unknown) {
      if (
        err instanceof AppError ||
        (typeof err === "object" && err !== null && (err as any).name === "AppError")
      ) {
        throw err;
      }
      const rawMessage = String((err as any)?.message || "");
      if (rawMessage.includes("invalid_revision_update")) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
        );
      }
      if (rawMessage.includes("stale_or_invalid_confirmation")) {
        throw new AppError(
          412,
          "CONFIRMATION_EXPIRED_OR_STALE",
          "La vista previa ha expirado o el borrador fue modificado. Genera una nueva vista previa."
        );
      }
      if (rawMessage.includes("overlapping_availability")) {
        throw new AppError(
          400,
          "INVALID_REQUEST",
          "Las ventanas de disponibilidad no pueden solaparse en el mismo día"
        );
      }
      if (rawMessage.includes("known_constraints_valid")) {
        throw new AppError(
          400,
          "INVALID_REQUEST",
          "Restricciones inválidas según el estado conocido/desconocido"
        );
      }
      if (rawMessage.includes("invalid_timezone")) {
        throw new AppError(
          400,
          "INVALID_REQUEST",
          "Zona horaria no válida"
        );
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2028") {
          throw new AppError(503, "DATABASE_TRANSACTION_TIMEOUT", "El guardado no pudo terminar a tiempo. Conservamos tus elecciones; puedes volver a intentar guardar.", true);
        }
        const meta = err.meta as { code?: string; driverAdapterError?: { cause?: { originalCode?: string; code?: string; message?: string } } } | undefined;
        const sqlCode = meta?.code ?? meta?.driverAdapterError?.cause?.originalCode ?? meta?.driverAdapterError?.cause?.code;
        const adapterMsg = meta?.driverAdapterError?.cause?.message || "";
        if (adapterMsg.includes("invalid_revision_update")) {
          throw new AppError(
            412,
            "DRAFT_REVISION_CONFLICT",
            "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
          );
        }
        if (adapterMsg.includes("overlapping_availability")) {
          throw new AppError(
            400,
            "INVALID_REQUEST",
            "Las ventanas de disponibilidad no pueden solaparse en el mismo día"
          );
        }
        if (adapterMsg.includes("known_constraints_valid")) {
          throw new AppError(
            400,
            "INVALID_REQUEST",
            "Restricciones inválidas según el estado conocido/desconocido"
          );
        }
        if (adapterMsg.includes("invalid_timezone")) {
          throw new AppError(
            400,
            "INVALID_REQUEST",
            "Zona horaria no válida"
          );
        }
        if (adapterMsg.includes("one_active_draft_per_profile") || err.message.includes("one_active_draft_per_profile")) {
          throw new AppError(
            409,
            "ACTIVE_DRAFT_EXISTS",
            "Ya existe un borrador activo para este perfil"
          );
        }
        if (sqlCode === "42501") {
          throw new AppError(403, "OPERATION_NOT_ALLOWED", "Operación no permitida");
        }
      }
      console.error("Database unexpected error in withActor:", err);
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
