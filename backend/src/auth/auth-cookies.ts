import { Request, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'bj_refresh';

/** Max-Age for refresh cookie (7 days default). */
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isProdEnv(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Build Set-Cookie value for the refresh token.
 * - httpOnly: not readable by JS
 * - secure: HTTPS only in production
 * - sameSite: None in prod (cross-origin API + credentials), Lax in development
 * - path: / so all API routes receive it
 */
export function setRefreshCookie(
  res: Response,
  refreshToken: string,
  maxAgeMs = REFRESH_COOKIE_MAX_AGE_MS,
): void {
  const prod = isProdEnv();
  const parts = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    'Path=/',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    'HttpOnly',
    prod ? 'Secure' : '',
    prod ? 'SameSite=None' : 'SameSite=Lax',
  ].filter(Boolean);
  res.append('Set-Cookie', parts.join('; '));
}

export function clearRefreshCookie(res: Response): void {
  const prod = isProdEnv();
  const parts = [
    `${REFRESH_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    prod ? 'Secure' : '',
    prod ? 'SameSite=None' : 'SameSite=Lax',
  ].filter(Boolean);
  res.append('Set-Cookie', parts.join('; '));
}

function readCookieValue(req: Request): string | undefined {
  const header = req.headers?.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key === REFRESH_COOKIE_NAME) {
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return undefined;
}

/**
 * Resolve refresh token for the request.
 * Cookie is always preferred. Body fallback only when allowBodyFallback is true (non-production).
 */
export function readRefreshFromRequest(
  req: Request,
  bodyToken?: string,
  options: { allowBodyFallback?: boolean } = {},
): string | undefined {
  const fromCookie = readCookieValue(req);
  if (fromCookie) return fromCookie;
  if (options.allowBodyFallback && bodyToken?.trim()) {
    return bodyToken.trim();
  }
  return undefined;
}

/** Attach refresh cookie and strip refreshToken from JSON body in production. */
export function attachRefreshCookieAndSanitize<T extends { refreshToken?: string }>(
  res: Response,
  result: T,
): Omit<T, 'refreshToken'> | T {
  if (result.refreshToken) {
    setRefreshCookie(res, result.refreshToken);
  }
  if (isProdEnv()) {
    const { refreshToken: _omit, ...rest } = result;
    return rest;
  }
  return result;
}
