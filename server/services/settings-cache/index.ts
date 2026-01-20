/**
 * Settings Caching Service
 * 
 * Provides in-memory caching for system settings with TTL-based expiration
 * and manual invalidation support. Reduces database load for frequently
 * accessed configuration values.
 */

import { logger } from '../../utils/logger';

export interface CacheConfig {
  ttlMs: number;
  maxEntries?: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

const DEFAULT_TTL_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_ENTRIES = 100;

class SettingsCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: Required<CacheConfig>;
  private hits = 0;
  private misses = 0;

  constructor(config: CacheConfig = { ttlMs: DEFAULT_TTL_MS }) {
    this.config = {
      ttlMs: config.ttlMs,
      maxEntries: config.maxEntries ?? DEFAULT_MAX_ENTRIES,
    };
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.config.maxEntries) {
      this.evictExpired();
      if (this.cache.size >= this.config.maxEntries) {
        this.evictOldest();
      }
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      createdAt: now,
      expiresAt: now + (ttlMs ?? this.config.ttlMs),
    });
  }

  invalidate(key: string): boolean {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    if (existed) {
      logger.debug(`Settings cache invalidated: ${key}`);
    }
    return existed;
  }

  invalidatePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      logger.debug(`Settings cache invalidated ${count} entries matching pattern`);
    }
    return count;
  }

  invalidateAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Settings cache cleared: ${size} entries removed`);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

export const settingsCache = new SettingsCache({
  ttlMs: 60 * 1000, // 1 minute default TTL
  maxEntries: 100,
});

export async function getCachedSetting<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number
): Promise<T> {
  const cached = settingsCache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const value = await fetcher();
  settingsCache.set(key, value, ttlMs);
  return value;
}

export function memoizeWithCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  ttlMs?: number
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = keyGenerator(...args);
    return getCachedSetting(key, () => fn(...args), ttlMs);
  }) as T;
}

export { SettingsCache };
