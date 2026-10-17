import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface VertexConfig {
  projectId: string;
  location: string;
  model: string;
  accessToken: string;
}

export class VertexAuth {
  private static cachedToken: { token: string; expiresAt: number } | null = null;

  static async getVertexConfig(): Promise<VertexConfig | null> {
    const projectId = this.resolveProjectId();
    const location = process.env.VERTEX_LOCATION || "global";
    const model = process.env.VERTEX_MODEL || "gemini-3.8-flash";

    const accessToken = await this.resolveAccessToken();
    if (!accessToken || !projectId) {
      return null;
    }

    return {
      projectId,
      location,
      model,
      accessToken,
    };
  }

  private static resolveProjectId(): string | null {
    if (process.env.VERTEX_PROJECT_ID) return process.env.VERTEX_PROJECT_ID;
    if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
    if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;

    // Intentar leer de gcloud config_default
    try {
      const gcloudConfigPath = process.platform === "win32"
        ? path.join(process.env.APPDATA || "", "gcloud", "configurations", "config_default")
        : path.join(os.homedir(), ".config", "gcloud", "configurations", "config_default");

      if (fs.existsSync(gcloudConfigPath)) {
        const content = fs.readFileSync(gcloudConfigPath, "utf8");
        const match = content.match(/project\s*=\s*([^\s\r\n]+)/);
        if (match && match[1]) return match[1].trim();
      }
    } catch {
      // Ignorar
    }

    return null;
  }

  private static async resolveAccessToken(): Promise<string | null> {
    // 1. Token explícito en variables de entorno
    if (process.env.VERTEX_BEARER_TOKEN && !process.env.VERTEX_BEARER_TOKEN.startsWith("mock-")) {
      return process.env.VERTEX_BEARER_TOKEN;
    }

    // 2. Token en caché válido
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
      return this.cachedToken.token;
    }

    // 3. Buscar archivo de Application Default Credentials (ADC)
    const adcPath = this.resolveAdcPath();
    if (!adcPath || !fs.existsSync(adcPath)) {
      return null;
    }

    try {
      const creds = JSON.parse(fs.readFileSync(adcPath, "utf8"));
      if (creds.type === "authorized_user" && creds.refresh_token && creds.client_id && creds.client_secret) {
        const resp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: creds.client_id,
            client_secret: creds.client_secret,
            refresh_token: creds.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.warn("[VertexAuth] Fallo al refrescar token ADC:", errText);
          return null;
        }

        const data = (await resp.json()) as { access_token: string; expires_in: number };
        this.cachedToken = {
          token: data.access_token,
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        };
        return data.access_token;
      }
    } catch (err) {
      console.warn("[VertexAuth] Error procesando archivo ADC:", (err as Error).message);
    }

    return null;
  }

  private static resolveAdcPath(): string | null {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    if (process.platform === "win32") {
      const appData = process.env.APPDATA;
      if (appData) {
        return path.join(appData, "gcloud", "application_default_credentials.json");
      }
    } else {
      return path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json");
    }
    return null;
  }
}
