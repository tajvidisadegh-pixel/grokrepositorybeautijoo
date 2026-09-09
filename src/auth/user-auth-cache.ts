/**
 * Lightweight in-memory TTL cache for JwtStrategy validated users.
 * Avoids a heavy Prisma include (roles + permissions + profile + professional)
 * on every authenticated request.
 *
 * Not a substitute for Redis in multi-instance deploys — each process has its
 * own cache. TTL is short so status/role changes propagate quickly.
 */

export type CachedAuthUser = {
  id: string;
  phone: string | null;
  roles: string[];
  permissions: string[];
  profile: unknown;
  professionalId: string | null;
  professionalStatus: string | null;
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
      // 0 = cache disabled
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
    // Refresh insertion order for simple LRU-ish behavior
    this.store.delete(userId);
    this.store.set(userId, entry);
    return entry.value;
  }

  set(userId: string, value: CachedAuthUser): void {
    if (this.ttlMs <= 0) return;
    if (this.store.size >= this.maxEntries) {
      // Evict oldest (first key in Map insertion order)
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(userId, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /** Call after role/status/ban changes so the next request reloads from DB. */
  invalidate(userId: string): void {
    this.store.delete(userId);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  get ttlMsConfigured(): number {
    return this.ttlMs;
  }
}

/** Process-wide singleton (one Nest process = one cache). */
export const userAuthCache = new UserAuthCache();
