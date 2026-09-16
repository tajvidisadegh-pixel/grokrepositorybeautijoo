/**
 * Access token lives in memory only (XSS cannot exfiltrate from localStorage).
 * Refresh token is an httpOnly Secure cookie set by the backend — never touch it from JS.
 */

let accessTokenMemory: string | null = null;

export function getAccessToken(): string | null {
  return accessTokenMemory;
}

/** @deprecated Refresh is cookie-only; always returns null. Kept for call-site compatibility. */
export function getRefreshToken(): string | null {
  return null;
}

export function setAccessToken(accessToken: string | null): void {
  accessTokenMemory = accessToken;
}

/** Store access token in memory. Refresh token is ignored (cookie-managed by backend). */
export function setTokens(accessToken: string): void {
  accessTokenMemory = accessToken;
}

export function clearTokens(): void {
  accessTokenMemory = null;
}
