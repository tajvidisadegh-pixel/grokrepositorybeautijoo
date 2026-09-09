/**
 * Centralized API client for Beautijoo backend.
 * Base URL: NEXT_PUBLIC_API_URL (must include /api/v1)
 * Auth: Bearer access token (memory); refresh via httpOnly cookie + credentials.
 */

import {
  clearTokens,
  getAccessToken,
  setTokens,
} from './auth-storage';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
    public correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  /** Skip automatic 401 → refresh retry */
  skipRefresh?: boolean;
};

function extractMessage(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data && 'message' in data) {
    const m = (data as { message: string | string[] }).message;
    return Array.isArray(m) ? m.join(', ') : String(m);
  }
  return fallback;
}

async function rawFetch(
  path: string,
  opts: RequestOptions = {},
): Promise<Response> {
  const {
    method = 'GET',
    body,
    token,
    headers = {},
    cache,
    next,
  } = opts;

  const url = path.startsWith('http')
    ? path
    : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;

  return fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache,
    next,
    // Required for httpOnly refresh cookie on cross-origin API
    credentials: 'include',
  });
}

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      // Cookie is sent automatically; no refresh token in body
      const res = await rawFetch('/auth/refresh', {
        method: 'POST',
        body: {},
        skipRefresh: true,
      });
      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const tokens = data as { accessToken?: string };
      if (!tokens.accessToken) {
        clearTokens();
        return null;
      }
      setTokens(tokens.accessToken);
      return tokens.accessToken;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function api<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const token =
    opts.token !== undefined ? opts.token : getAccessToken();

  let res = await rawFetch(path, { ...opts, token });

  if (res.status === 401 && !opts.skipRefresh && typeof window !== 'undefined') {
    const newAccess = await tryRefresh();
    if (newAccess) {
      res = await rawFetch(path, { ...opts, token: newAccess });
    }
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg = extractMessage(data, res.statusText);
    const correlationId =
      typeof data === 'object' && data && 'correlationId' in data
        ? String((data as { correlationId: string }).correlationId)
        : undefined;
    throw new ApiError(res.status, msg, data, correlationId);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    api<T>(path, { ...opts, method: 'GET' }),
  post: <T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'body'>,
  ) => api<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'body'>,
  ) => api<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'body'>,
  ) => api<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    api<T>(path, { ...opts, method: 'DELETE' }),
};

export { API_URL, tryRefresh };
