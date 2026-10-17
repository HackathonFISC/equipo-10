import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "../errors";
import type { APIConfig } from "../config";

export interface VerifiedIdentity {
  id: string;
  email: string;
}

export type VerifyToken = (token: string) => Promise<VerifiedIdentity>;

const UuidSchema = z.string().uuid();
const EmailSchema = z.string().email();

export function createVerifyToken(config: APIConfig): VerifyToken {
  const supabase = createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: Object.assign((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }), { preconnect: fetch.preconnect }),
    },
  });

  return async (token: string): Promise<VerifiedIdentity> => {
    try {
      const response = await supabase.auth.getUser(token);

      if (response.error) {
        const status = response.error.status ?? 0;
        const isRetryable = response.error.name === "AuthRetryableFetchError" || status === 429 || status >= 500;
        if (isRetryable) {
          throw new AppError(503, "AUTH_UNAVAILABLE", "Servicio de autenticación no disponible", true);
        }
        throw new AppError(401, "AUTH_REQUIRED", "Sesión inválida o expirada");
      }

      if (!response.data?.user) {
        throw new AppError(401, "AUTH_REQUIRED", "Sesión inválida o expirada");
      }

      const user = response.data.user;
      const idParse = UuidSchema.safeParse(user.id);
      const emailParse = EmailSchema.safeParse(user.email);

      if (!idParse.success || !emailParse.success) {
        throw new AppError(401, "AUTH_REQUIRED", "Identidad no válida");
      }

      if (!user.email_confirmed_at) {
        throw new AppError(403, "EMAIL_NOT_VERIFIED", "El correo electrónico no ha sido confirmado");
      }

      return {
        id: idParse.data,
        email: emailParse.data,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      throw new AppError(503, "AUTH_UNAVAILABLE", "Servicio de autenticación no disponible", true);
    }
  };
}
