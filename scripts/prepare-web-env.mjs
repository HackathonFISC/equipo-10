import { readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const PUBLISHABLE_PATTERN = /^sb_publishable_[A-Za-z0-9_-]+$/;
const PROJECT_REF_HOST_PATTERN = /^[a-z0-9_-]+\.supabase\.co$/;

function validateSupabaseUrl(raw) {
  if (typeof raw !== "string" || raw.includes("\r") || raw.includes("\n")) {
    throw new Error("ERR_INVALID_SUPABASE_URL");
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("ERR_INVALID_SUPABASE_URL");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    (parsed.pathname !== "/" && parsed.pathname !== "") ||
    !PROJECT_REF_HOST_PATTERN.test(parsed.hostname)
  ) {
    throw new Error("ERR_INVALID_SUPABASE_URL");
  }
  return `https://${parsed.hostname}`;
}

function validatePublishableKey(raw) {
  if (typeof raw !== "string" || raw.includes("\r") || raw.includes("\n")) {
    throw new Error("ERR_INVALID_PUBLISHABLE_KEY");
  }
  if (PUBLISHABLE_PATTERN.test(raw)) {
    return raw;
  }
  const parts = raw.split(".");
  if (parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (payload && typeof payload === "object" && payload.role === "anon") {
        return raw;
      }
    } catch {
      // decode/parse error handled below
    }
  }
  throw new Error("ERR_INVALID_PUBLISHABLE_KEY");
}

function validateApiUrl(raw) {
  if (raw === undefined || raw === "") {
    return "http://127.0.0.1:3001";
  }
  if (typeof raw !== "string" || raw.includes("\r") || raw.includes("\n")) {
    throw new Error("ERR_INVALID_API_URL");
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("ERR_INVALID_API_URL");
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    throw new Error("ERR_INVALID_API_URL");
  }
  return parsed.origin;
}

export function makePublicEnv(env = {}) {
  const supabaseUrl = validateSupabaseUrl(env.SUPABASE_URL);
  const publishableKey = validatePublishableKey(env.SUPABASE_PUBLISHABLE_KEY);
  const apiUrl = validateApiUrl(env.VITE_API_URL);

  return [
    `VITE_SUPABASE_URL=${JSON.stringify(supabaseUrl)}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${JSON.stringify(publishableKey)}`,
    `VITE_API_URL=${JSON.stringify(apiUrl)}`,
    "",
  ].join("\n");
}

export function main() {
  const targetPath = fileURLToPath(new URL("../apps/web/.env.local", import.meta.url));
  let nextContent;
  try {
    nextContent = makePublicEnv(process.env);
  } catch (err) {
    console.error(`Error: [${err.message || "ERR_VALIDATION_FAILED"}] Web environment preparation failed.`);
    process.exit(1);
  }

  let existingContent = "";
  try {
    existingContent = readFileSync(targetPath, "utf8");
  } catch {
    existingContent = "";
  }

  if (existingContent === nextContent) {
    return;
  }

  const tempPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  try {
    writeFileSync(tempPath, nextContent, { mode: 0o600, flag: "wx" });
    renameSync(tempPath, targetPath);
  } catch (writeErr) {
    try {
      unlinkSync(tempPath);
    } catch {
      // temp cleanup ignore
    }
    console.error(`Error: [ERR_WRITE_FAILED] Failed to atomically write web environment file.`);
    process.exit(1);
  }
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main();
}
