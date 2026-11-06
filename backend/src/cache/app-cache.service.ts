import { Injectable, Logger } from '@nestjs/common';

type Entry = { value: unknown; expiresAt: number };

/**
 * Process-local TTL cache for public catalog (search, categories, slug).
 * Optional Redis can replace this later when REDIS_URL is available.
 * Disable with APP_CACHE_TTL_SECONDS=0.
 * In NODE_ENV=test, disabled by default so e2e sees fresh DB state.
 */
@Injectable()
export class AppCacheService {
  private readonly logger = new Logger(AppCacheService.name);
  private readonly store = new Map<string, Entry>();
  private readonly maxEntries = 2_000;
  private readonly defaultTtlMs: number;

  constructor() {
    const raw = process.env.APP_CACHE_TTL_SECONDS;
    if (raw !== undefined && raw !== '') {
      const sec = parseInt(raw, 10);
      this.defaultTtlMs = !Number.isNaN(sec) && sec >= 0 ? sec * 1000 : 60_000;
    } else if ((process.env.NODE_ENV || '').toLowerCase() === 'test') {
      this.defaultTtlMs = 0;
    } else {
      this.defaultTtlMs = 60_000;
    }
  }

  get enabled(): boolean {
    return this.defaultTtlMs > 0;
  }

  get<T>(key: string): T | undefined {
    if (!this.enabled) return undefined;
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs?: number): void {
    if (!this.enabled) return;
    const ttl = ttlMs ?? this.defaultTtlMs;
    if (ttl <= 0) return;
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const k of [...this.store.keys()]) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  invalidateCatalog(): void {
    this.invalidatePrefix('catalog:');
    this.logger.debug('catalog cache invalidated');
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
