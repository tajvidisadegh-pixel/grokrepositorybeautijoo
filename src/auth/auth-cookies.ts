import { Request, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'bj_refresh';

/** Max-Age for refresh cookie (7 days default). */
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isProdEnv(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Body refreshToken is a legacy/dev escape hatch only.
 * Enabled when REFRESH_ALLOW_BODY=true, or automatically in non-production.
 * Production defaults to cookie-only (body ignored).
 */
export function allowRefreshBodyFallback(): boolean {
  const flag = (process.env.REFRESH_ALLOW_BODY || '').toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return !isProdEnv();
}

function cookieSameSite(): 'None' | 'Lax' | 'Strict' {
  const raw = (process.env.COOKIE_SAMESITE || '').toLowerCase();
  if (raw === 'none') return 'None';
  if (raw === 'strict') return 'Strict';
  if (raw === 'lax') return 'Lax';
  // Default: Lax is enough for beautijoo.ir ↔ api.beautijoo.ir (same-site).
  // Use COOKIE_SAMESITE=None only when frontend is on a different site.
  return 'Lax';
}

function cookieDomain(): string | undefined {
  const d = (process.env.COOKIE_DOMAIN || '').trim();
  return d || undefined;
}

/**
 * Build Set-Cookie value for the refresh token.
 * - httpOnly: not readable by JS
 * - secure: HTTPS only in production (or COOKIE_SECURE=true)
 * - sameSite: Lax by default (same-site subdomains); override via COOKIE_SAMESITE
 * - domain: optional COOKIE_DOMAIN (e.g. .beautijoo.ir)
 * - path: / so /api/v1/auth/* receives it
 */
export function setRefreshCookie(
  res: Response,
  refreshToken: string,
  maxAgeMs = REFRESH_COOKIE_MAX_AGE_MS,
): void {
  const prod = isProdEnv();
  const secure =
    (process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || prod;
  const sameSite = cookieSameSite();
  // SameSite=None requires Secure
  const forceSecure = sameSite === 'None' ? true : secure;
  const parts = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    'Path=/',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    'HttpOnly',
    forceSecure ? 'Secure' : '',
    `SameSite=${sameSite}`,
  ].filter(Boolean);
  const domain = cookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
  res.append('Set-Cookie', parts.join('; '));
}

export function clearRefreshCookie(res: Response): void {
  const prod = isProdEnv();
  const secure =
    (process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || prod;
  const sameSite = cookieSameSite();
  const forceSecure = sameSite === 'None' ? true : secure;
  const parts = [
    `${REFRESH_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    forceSecure ? 'Secure' : '',
    `SameSite=${sameSite}`,
  ].filter(Boolean);
  const domain = cookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
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
 * Cookie is always preferred. Body fallback only when allowBodyFallback is true.
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
  // Never expose refresh token in JSON when body fallback is disabled (prod default)
  if (!allowRefreshBodyFallback()) {
    const { refreshToken: _omit, ...rest } = result;
    return rest;
  }
  return result;
}
