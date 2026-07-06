const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  'http://localhost:3001';
const REQUEST_TIMEOUT_MS = 10_000;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const ACCESS_KEY = 'comercia.accessToken';
const REFRESH_KEY = 'comercia.refreshToken';
let refreshRequest: Promise<string | null> | null = null;

export function storeTokens(tokens: AuthTokens) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getStoredAccessToken() {
  return typeof window === 'undefined'
    ? null
    : localStorage.getItem(ACCESS_KEY);
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const accessToken = getStoredAccessToken();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        `La API no respondi\u00f3 a tiempo. Verifica ${API_URL}.`,
      );
    }
    throw new ApiError(
      `No se pudo conectar con la API en ${API_URL}. Verifica NEXT_PUBLIC_API_URL.`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 && retry && typeof window !== 'undefined') {
    const renewed = await refreshAccessToken();
    if (renewed) return apiRequest<T>(path, init, false);
    clearTokens();
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new ApiError(
      message ??
        (response.status === 401 || response.status === 403
          ? 'Tu sesi\u00f3n no es v\u00e1lida o no tienes permisos.'
          : 'No se pudo completar la solicitud'),
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

async function refreshAccessToken() {
  if (refreshRequest) return refreshRequest;
  refreshRequest = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      clearTokens();
      return null;
    }
    const tokens = (await response.json()) as AuthTokens;
    storeTokens(tokens);
    return tokens.accessToken;
  })();
  try {
    return await refreshRequest;
  } finally {
    refreshRequest = null;
  }
}
