/**
 * Impersonation state — memory only (aligned with auth-storage).
 * Never put access tokens in sessionStorage/localStorage (XSS risk).
 */

let adminAccessBackupMemory: string | null = null;

export type ImpersonationMeta = {
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  startedAt: string;
};

let metaMemory: ImpersonationMeta | null = null;

export function saveAdminAccessBackup(accessToken: string) {
  if (typeof window === 'undefined') return;
  adminAccessBackupMemory = accessToken;
}

export function takeAdminAccessBackup(): string | null {
  if (typeof window === 'undefined') return null;
  const v = adminAccessBackupMemory;
  adminAccessBackupMemory = null;
  return v;
}

export function peekAdminAccessBackup(): string | null {
  if (typeof window === 'undefined') return null;
  return adminAccessBackupMemory;
}

export function setImpersonationMeta(meta: ImpersonationMeta) {
  if (typeof window === 'undefined') return;
  metaMemory = meta;
}

export function getImpersonationMeta(): ImpersonationMeta | null {
  if (typeof window === 'undefined') return null;
  return metaMemory;
}

export function clearImpersonationMeta() {
  if (typeof window === 'undefined') return;
  metaMemory = null;
}
