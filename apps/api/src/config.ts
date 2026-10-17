import { readFileSync } from "node:fs";
import { AppError } from "./errors";

export interface APIConfig {
  databaseUrl: string;
  caFile: string | null;
  supabaseUrl: string;
  publishableKey: string;
  allowedOrigins: string[];
  port: number;
  host: string;
  testDatabase: boolean;
}

export function readConfig(env: Record<string, string | undefined>): APIConfig {
  const isTest = env.NODE_ENV === "test";
  let databaseUrl = env.DATABASE_URL;
  let isTestDb = false;

  if (isTest) {
    if (!env.TEST_DATABASE_URL) {
      throw new AppError(500, "CONFIG_ERROR", "Falta TEST_DATABASE_URL en entorno de test");
    }
    const liveUrl = env.DATABASE_URL;
    if (liveUrl && env.TEST_DATABASE_URL === liveUrl) {
      throw new AppError(500, "CONFIG_ERROR", "Configuración de base de datos de pruebas inválida");
    }

    let parsedTestUrl: URL;
    try {
      parsedTestUrl = new URL(env.TEST_DATABASE_URL);
    } catch {
      throw new AppError(500, "CONFIG_ERROR", "URL de base de datos de pruebas inválida");
    }

    if (parsedTestUrl.protocol !== "postgresql:" && parsedTestUrl.protocol !== "postgres:") {
      throw new AppError(500, "CONFIG_ERROR", "Protocolo de base de datos de pruebas no compatible");
    }

    const host = parsedTestUrl.hostname;
    const port = parsedTestUrl.port;
    const pathname = parsedTestUrl.pathname.replace(/^\//, "");

    if ((host !== "127.0.0.1" && host !== "localhost") || port !== "55435" || pathname !== "equipo10_d1_test") {
      throw new AppError(500, "CONFIG_ERROR", "Base de datos de pruebas no permitida fuera del entorno local");
    }

    if (parsedTestUrl.search !== "") {
      throw new AppError(500, "CONFIG_ERROR", "Parámetros query no permitidos en TEST_DATABASE_URL");
    }

    databaseUrl = env.TEST_DATABASE_URL;
    isTestDb = true;
  }

  if (!databaseUrl) {
    throw new AppError(500, "CONFIG_ERROR", "Falta URL de conexión a la base de datos");
  }

  let parsedDbUrl: URL;
  try {
    parsedDbUrl = new URL(databaseUrl);
  } catch {
    throw new AppError(500, "CONFIG_ERROR", "Formato de DATABASE_URL inválido");
  }

  if (parsedDbUrl.protocol !== "postgresql:" && parsedDbUrl.protocol !== "postgres:") {
    throw new AppError(500, "CONFIG_ERROR", "Protocolo de base de datos no compatible");
  }

  const username = decodeURIComponent(parsedDbUrl.username);
  const firstSegment = username.split(".")[0];
  if (firstSegment !== "equipo10_api") {
    throw new AppError(500, "CONFIG_ERROR", "Usuario de base de datos no autorizado para API");
  }

  const allowedQueryKeys = new Set([
    "schema",
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "sslaccept",
    "sslnegotiation",
  ]);
  for (const key of parsedDbUrl.searchParams.keys()) {
    if (!allowedQueryKeys.has(key)) {
      throw new AppError(500, "CONFIG_ERROR", `Parámetro de conexión no permitido: ${key}`);
    }
  }

  let caFile: string | null = null;
  if (!isTestDb) {
    const caPath = env.DATABASE_SSL_CA_FILE ?? "certs/supabase-prod-ca-2021.crt";
    try {
      readFileSync(caPath, "utf-8");
      caFile = caPath;
    } catch {
      throw new AppError(500, "CONFIG_ERROR", "No se pudo leer el archivo de certificado CA");
    }
  }

  const supabaseUrl = env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new AppError(500, "CONFIG_ERROR", "Falta SUPABASE_URL");
  }

  let parsedSupabaseUrl: URL;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new AppError(500, "CONFIG_ERROR", "SUPABASE_URL inválida");
  }

  let projectRef = "";
  if (parsedSupabaseUrl.protocol !== "https:") {
    if (!(isTest && (parsedSupabaseUrl.hostname === "127.0.0.1" || parsedSupabaseUrl.hostname === "localhost"))) {
      throw new AppError(500, "CONFIG_ERROR", "SUPABASE_URL debe utilizar HTTPS");
    }
  } else {
    const parts = parsedSupabaseUrl.hostname.split(".");
    if (parts.length !== 3 || parts[1] !== "supabase" || parts[2] !== "co") {
      if (!isTest) {
        throw new AppError(500, "CONFIG_ERROR", "SUPABASE_URL inválida para producción");
      }
    } else {
      projectRef = parts[0];
    }
  }

  if (!isTestDb) {
    if (parsedDbUrl.port !== "5432") {
      throw new AppError(500, "CONFIG_ERROR", "DATABASE_URL debe usar el puerto 5432");
    }
    const dbHost = parsedDbUrl.hostname;
    const isDirect = dbHost === `db.${projectRef}.supabase.co`;
    const isPooler = dbHost.endsWith(".pooler.supabase.com");
    if (!isDirect && !isPooler) {
      throw new AppError(500, "CONFIG_ERROR", "DATABASE_URL host inválido para producción");
    }
    if (isDirect && username !== "equipo10_api") {
      throw new AppError(500, "CONFIG_ERROR", "Usuario directo debe ser exactamente equipo10_api");
    }
    if (isPooler && username !== `equipo10_api.${projectRef}`) {
      throw new AppError(500, "CONFIG_ERROR", "Usuario de pooler debe ser equipo10_api.[ref]");
    }
  }

  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new AppError(500, "CONFIG_ERROR", "Falta clave pública de Supabase");
  }

  if (publishableKey.startsWith("sb_secret_")) {
    throw new AppError(500, "CONFIG_ERROR", "Clave de Supabase no permitida en API pública");
  }

  try {
    const parts = publishableKey.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      if (payload.role === "service_role") {
        throw new AppError(500, "CONFIG_ERROR", "Clave service_role denegada");
      }
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
  }

  const allowedOrigins = ["http://127.0.0.1:5173", "http://localhost:5173"];
  if (env.WEB_ORIGIN) {
    let parsedWebOrigin: URL;
    try {
      parsedWebOrigin = new URL(env.WEB_ORIGIN);
    } catch {
      throw new AppError(500, "CONFIG_ERROR", "WEB_ORIGIN inválido");
    }
    if (parsedWebOrigin.protocol !== "http:" && parsedWebOrigin.protocol !== "https:") {
      throw new AppError(500, "CONFIG_ERROR", "WEB_ORIGIN debe usar http o https");
    }
    if (parsedWebOrigin.origin !== env.WEB_ORIGIN || parsedWebOrigin.username || parsedWebOrigin.password) {
      throw new AppError(500, "CONFIG_ERROR", "WEB_ORIGIN debe ser un origen exacto");
    }
    if (!allowedOrigins.includes(env.WEB_ORIGIN)) {
      allowedOrigins.push(env.WEB_ORIGIN);
    }
  }

  const port = env.PORT ? Number.parseInt(env.PORT, 10) : 3001;
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new AppError(500, "CONFIG_ERROR", "Puerto inválido");
  }

  const host = env.HOST ?? "127.0.0.1";
  if (host !== "127.0.0.1") {
    throw new AppError(500, "CONFIG_ERROR", "Host inválido, solo 127.0.0.1 es permitido");
  }

  return {
    databaseUrl,
    caFile,
    supabaseUrl,
    publishableKey,
    allowedOrigins,
    port,
    host,
    testDatabase: isTestDb,
  };
}
