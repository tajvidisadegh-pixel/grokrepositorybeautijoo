const BACKUP_KEY = 'bj_imp_admin_access';
const META_KEY = 'bj_imp_meta';

export type ImpersonationMeta = {
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  startedAt: string;
};

export function saveAdminAccessBackup(accessToken: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(BACKUP_KEY, accessToken);
}

export function takeAdminAccessBackup(): string | null {
  if (typeof window === 'undefined') return null;
  const v = sessionStorage.getItem(BACKUP_KEY);
  sessionStorage.removeItem(BACKUP_KEY);
  return v;
}

export function peekAdminAccessBackup(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(BACKUP_KEY);
}

export function setImpersonationMeta(meta: ImpersonationMeta) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function getImpersonationMeta(): ImpersonationMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ImpersonationMeta;
  } catch {
    return null;
  }
}

export function clearImpersonationMeta() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(META_KEY);
}
