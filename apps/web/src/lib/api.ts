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

export interface FetchResponse<T> {
  data: T;
  etag: string | null;
  requestId: string | null;
}

export async function fetchWithHeaders<T>(
  path: string,
  token: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {}
): Promise<FetchResponse<T>> {
  if (
    !path.startsWith('/me') &&
    !path.startsWith('/organizations/') &&
    !path.startsWith('/opportunities') &&
    !path.startsWith('/courses') &&
    !path.startsWith('/learning-plans')
  ) {
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

  const method = options.method || 'GET';
  const fullUrl = `${baseOrigin}/api/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  let requestBody: any;
  if (options.body !== undefined) {
    if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
      requestBody = options.body;
    } else {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(options.body);
    }
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method,
      headers,
      body: requestBody,
      signal: options.signal,
    });
  } catch (err: unknown) {
    if (options.signal?.aborted) {
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

  const etag = response.headers.get('ETag');
  const requestId = response.headers.get('X-Request-Id');
  const json = await response.json();
  let data: T;
  if (typeof json === 'object' && json !== null && 'data' in json) {
    data = (json as DataEnvelope<T>).data;
  } else {
    data = json as T;
  }

  return { data, etag, requestId };
}

export async function fetchData<T>(
  path: string,
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
  signal?: AbortSignal,
  customHeaders?: Record<string, string>
): Promise<T> {
  const res = await fetchWithHeaders<T>(path, token, {
    method,
    body,
    signal,
    headers: customHeaders,
  });
  return res.data;
}

