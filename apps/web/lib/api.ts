const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const accessToken =
    typeof window === 'undefined' ? null : localStorage.getItem(ACCESS_KEY);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && typeof window !== 'undefined') {
    const renewed = await refreshAccessToken();
    if (renewed) return apiRequest<T>(path, init, false);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new Error(message ?? 'No se pudo completar la solicitud');
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
