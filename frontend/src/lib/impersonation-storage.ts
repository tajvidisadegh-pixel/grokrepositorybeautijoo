/**
 * Impersonation state.
 * Admin access backup uses sessionStorage so a page reload does not trap the
 * admin inside the customer session (memory-only was lost on reload).
 * sessionStorage is tab-scoped and cleared when the tab closes — better than
 * localStorage, and required for practical exit-impersonation UX.
 */

const ADMIN_BACKUP_KEY = 'bj_imp_admin_access_v1';
const META_KEY = 'bj_imp_meta_v1';

export type ImpersonationMeta = {
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  startedAt: string;
};

function canUseSession(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

export function saveAdminAccessBackup(accessToken: string) {
  if (!canUseSession()) return;
  try {
    sessionStorage.setItem(ADMIN_BACKUP_KEY, accessToken);
  } catch {
    /* private mode / quota */
  }
}

export function takeAdminAccessBackup(): string | null {
  if (!canUseSession()) return null;
  try {
    const v = sessionStorage.getItem(ADMIN_BACKUP_KEY);
    sessionStorage.removeItem(ADMIN_BACKUP_KEY);
    return v;
  } catch {
    return null;
  }
}

export function peekAdminAccessBackup(): string | null {
  if (!canUseSession()) return null;
  try {
    return sessionStorage.getItem(ADMIN_BACKUP_KEY);
  } catch {
    return null;
  }
}

export function setImpersonationMeta(meta: ImpersonationMeta) {
  if (!canUseSession()) return;
  try {
    sessionStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function getImpersonationMeta(): ImpersonationMeta | null {
  if (!canUseSession()) return null;
  try {
    const raw = sessionStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ImpersonationMeta;
  } catch {
    return null;
  }
}

export function clearImpersonationMeta() {
  if (!canUseSession()) return;
  try {
    sessionStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
}
