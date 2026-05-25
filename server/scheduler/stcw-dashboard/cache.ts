/**
 * STCW Dashboard Cache - In-memory caching with bounded LRU eviction
 */

const stcwCache = new Map<string, { data: unknown; timestamp: number }>();
const STCW_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STCW_CACHE_MAX_SIZE = 30;

export function getCacheKey(type: string, orgId: string, extra?: string): string {
  return `${type}:${orgId}${extra ? `:${extra}` : ""}`;
}

export function getFromCache<T>(key: string): T | null {
  const cached = stcwCache.get(key);
  if (cached && Date.now() - cached.timestamp < STCW_CACHE_TTL_MS) {
    return cached.data as T;
  }
  stcwCache.delete(key);
  return null;
}

export function setCache(key: string, data: unknown): void {
  const d = data as { vessels?: unknown[]; fleet?: { totalVessels?: number } } | null | undefined;
  if (!d || (d.vessels && d.vessels.length === 0 && d.fleet?.totalVessels === 0)) {
    return;
  }

  stcwCache.set(key, { data, timestamp: Date.now() });

  if (stcwCache.size > STCW_CACHE_MAX_SIZE) {
    const oldestEntry = Array.from(stcwCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    )[0];
    if (oldestEntry) {
      stcwCache.delete(oldestEntry[0]);
    }
  }
}

export function invalidateSTCWCache(orgId?: string): void {
  if (orgId) {
    for (const key of stcwCache.keys()) {
      // Match keys with orgId: type:orgId or type:orgId:extra
      if (key.includes(`:${orgId}:`) || key.endsWith(`:${orgId}`)) {
        stcwCache.delete(key);
      }
    }
  } else {
    stcwCache.clear();
  }
}
