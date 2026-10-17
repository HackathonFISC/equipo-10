import { ApiErrorResponseSchema, MeViewSchema, type MeView } from '@equipo10/contracts';

export { MeViewSchema, type MeView };

export interface DataEnvelope<T> {
  data: T;
  request_id: string;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, retryable: boolean) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const SPANISH_STATUS_MESSAGES: Record<number, string> = {
  401: 'Sesión no autorizada o expirada.',
  403: 'Acceso denegado o correo electrónico no verificado.',
  404: 'Recurso no encontrado.',
  503: 'Servicio temporalmente no disponible. Reintente en un momento.',
};

export async function fetchData<T>(
  path: string,
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  if (!path.startsWith('/me') && !path.startsWith('/organizations/')) {
    throw new ApiClientError(400, 'INVALID_PATH', 'Ruta no permitida.', false);
  }

  const rawBase = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
  let baseOrigin: string;
  try {
    const parsed = new URL(rawBase);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error();
    }
    baseOrigin = parsed.origin;
  } catch {
    throw new ApiClientError(500, 'CONFIG_ERROR', 'Configuración de API inválida.', false);
  }

  const fullUrl = `${baseOrigin}/api/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  let requestBody: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method,
      headers,
      body: requestBody,
      signal,
    });
  } catch (err: unknown) {
    if (signal?.aborted) {
      throw err;
    }
    throw new ApiClientError(503, 'NETWORK_ERROR', SPANISH_STATUS_MESSAGES[503], true);
  }

  if (!response.ok) {
    let parsedError: unknown;
    try {
      parsedError = await response.json();
    } catch {
      parsedError = null;
    }
    const parsedSchema = ApiErrorResponseSchema.safeParse(parsedError);
    if (parsedSchema.success) {
      const err = parsedSchema.data.error;
      throw new ApiClientError(response.status, err.code, err.message, err.retryable);
    }
    const fallbackMessage = SPANISH_STATUS_MESSAGES[response.status] || 'Error de comunicación con el servidor.';
    throw new ApiClientError(response.status, `HTTP_${response.status}`, fallbackMessage, response.status >= 500);
  }

  const json = await response.json();
  if (typeof json === 'object' && json !== null && 'data' in json) {
    return (json as DataEnvelope<T>).data;
  }
  return json as T;
}
