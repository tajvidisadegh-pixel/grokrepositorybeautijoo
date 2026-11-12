/**
 * Lightweight in-memory TTL cache for JwtStrategy validated users.
 * Avoids a heavy Prisma include (roles + permissions + profile + professional)
 * on every authenticated request.
 *
 * #82.15 multi-instance:
 * - Each process still has its own Map (no Redis required).
 * - JwtStrategy stores `cachedAt` and on every hit re-checks
 *   `users.status` + `users.updatedAt`. If the row was updated after the
 *   entry was cached (role/status change on another instance), the entry is
 *   dropped and reloaded — so multi-instance stays correct without pub/sub.
 * - Call `invalidate(userId)` from admin paths that change status or roles
 *   so the same instance drops the entry immediately.
 * - Set JWT_USER_CACHE_TTL_SECONDS=0 to disable the cache entirely.
 * - Prefer short TTL (default 30s) as an extra safety bound.
 */

export type CachedAuthUser = {
  id: string;
  phone: string | null;
  roles: string[];
  permissions: string[];
  profile: unknown;
  professionalId: string | null;
  professionalStatus: string | null;
  /** Present when access token is an impersonation session (issue #22). */
  isImpersonating?: boolean;
  impersonatorId?: string | null;
  /** Epoch ms when this entry was written — used for multi-instance freshness. */
  cachedAt?: number;
};

type Entry = {
  value: CachedAuthUser;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 5_000;

function resolveTtlMs(): number {
  const raw = process.env.JWT_USER_CACHE_TTL_SECONDS;
  if (raw) {
    const sec = parseInt(raw, 10);
    if (!Number.isNaN(sec) && sec >= 0) {
      return sec * 1000;
    }
  }
  return DEFAULT_TTL_MS;
}

class UserAuthCache {
  private store = new Map<string, Entry>();
  private ttlMs = resolveTtlMs();
  private maxEntries = DEFAULT_MAX_ENTRIES;

  get(userId: string): CachedAuthUser | undefined {
    if (this.ttlMs <= 0) return undefined;
    const entry = this.store.get(userId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(userId);
      return undefined;
    }
    this.store.delete(userId);
    this.store.set(userId, entry);
    return entry.value;
  }

  set(userId: string, value: CachedAuthUser): void {
    if (this.ttlMs <= 0) return;
    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
    const stamped: CachedAuthUser = {
      ...value,
      cachedAt: value.cachedAt ?? Date.now(),
    };
    this.store.set(userId, { value: stamped, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(userId: string): void {
    this.store.delete(userId);
  }

  clear(): void {
    this.store.clear();
  }
}

export const userAuthCache = new UserAuthCache();
