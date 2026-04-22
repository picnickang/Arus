import { db } from "../../../db";
import { eq, and } from "drizzle-orm";
import { externalDataCache } from "@shared/schema/external-data-cache";

export interface CachedResult<T = Record<string, unknown>> {
  data: T;
  fetchedAt: Date;
  stale: boolean;
  /** Age of the cached data in seconds. */
  ageSec: number;
  /** Human-readable staleness label. */
  ageLabel: string;
  fromCache: boolean;
  fetchError?: string;
}

/**
 * Read a cached external response.
 * Returns null if no cached value exists for the key.
 */
export async function getCachedExternal<T = Record<string, unknown>>(
  orgId: string,
  provider: string,
  cacheKey: string
): Promise<CachedResult<T> | null> {
  const [row] = await db
    .select()
    .from(externalDataCache)
    .where(
      and(
        eq(externalDataCache.orgId, orgId),
        eq(externalDataCache.provider, provider),
        eq(externalDataCache.cacheKey, cacheKey)
      )
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const fetchedAt = row.fetchedAt ?? new Date(0);
  const ageSec = Math.floor((Date.now() - fetchedAt.getTime()) / 1000);
  const ttl = row.ttlSeconds ?? 3600;
  const stale = ageSec > ttl;

  return {
    data: row.data as T,
    fetchedAt,
    stale,
    ageSec,
    ageLabel: formatAge(ageSec),
    fromCache: true,
    fetchError: row.fetchError ?? undefined,
  };
}

/**
 * Upsert a cached external response.
 * Creates or updates the row for (orgId, provider, cacheKey).
 */
export async function setCachedExternal(
  orgId: string,
  provider: string,
  cacheKey: string,
  data: Record<string, unknown>,
  ttlSeconds = 3600,
  fetchStatus = "ok",
  fetchError?: string
): Promise<void> {
  const existing = await db
    .select({ id: externalDataCache.id })
    .from(externalDataCache)
    .where(
      and(
        eq(externalDataCache.orgId, orgId),
        eq(externalDataCache.provider, provider),
        eq(externalDataCache.cacheKey, cacheKey)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(externalDataCache)
      .set({
        data,
        ttlSeconds,
        fetchStatus,
        fetchError: fetchError ?? null,
        fetchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(externalDataCache.id, existing[0].id));
  } else {
    await db.insert(externalDataCache).values({
      orgId,
      provider,
      cacheKey,
      data,
      ttlSeconds,
      fetchStatus,
      fetchError: fetchError ?? null,
    });
  }
}

/**
 * Attempt to fetch from an external API.
 * On success, caches the result.  On failure, returns cached data if available.
 */
export async function fetchWithCacheFallback<T = Record<string, unknown>>(
  orgId: string,
  provider: string,
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttlSeconds = 3600
): Promise<CachedResult<T>> {
  try {
    const freshData = await fetchFn();
    await setCachedExternal(
      orgId,
      provider,
      cacheKey,
      freshData as Record<string, unknown>,
      ttlSeconds
    );
    return {
      data: freshData,
      fetchedAt: new Date(),
      stale: false,
      ageSec: 0,
      ageLabel: "just now",
      fromCache: false,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Fetch failed";
    console.warn(`[ExternalCache] ${provider}/${cacheKey} fetch failed: ${errorMsg}`);

    await recordFetchError(orgId, provider, cacheKey, errorMsg).catch(() => {});

    // Try to return stale cached data
    const cached = await getCachedExternal<T>(orgId, provider, cacheKey);
    if (cached && cached.data && Object.keys(cached.data as Record<string, unknown>).length > 0) {
      return {
        ...cached,
        stale: true,
        fetchError: `Live fetch failed (${errorMsg}). Showing cached data from ${cached.ageLabel}.`,
      };
    }

    // No cached data at all
    return {
      data: { error: `External data unavailable — ${errorMsg}`, offline: true } as unknown as T,
      fetchedAt: new Date(0),
      stale: true,
      ageSec: Infinity,
      ageLabel: "never fetched",
      fromCache: false,
      fetchError: errorMsg,
    };
  }
}

/**
 * Delete cache entries whose last fetch is older than `maxAgeDays`.
 */
export async function purgeStaleCache(maxAgeDays = 30): Promise<number> {
  const { sql } = await import("drizzle-orm");
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000);
  const result = await db.execute(
    sql`DELETE FROM external_data_cache WHERE fetched_at < ${cutoff} RETURNING id`
  );
  return (result as { rows?: unknown[] }).rows?.length ?? 0;
}

async function recordFetchError(
  orgId: string,
  provider: string,
  cacheKey: string,
  errorMsg: string
): Promise<void> {
  const existing = await db
    .select({ id: externalDataCache.id })
    .from(externalDataCache)
    .where(
      and(
        eq(externalDataCache.orgId, orgId),
        eq(externalDataCache.provider, provider),
        eq(externalDataCache.cacheKey, cacheKey)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(externalDataCache)
      .set({
        fetchStatus: "error",
        fetchError: errorMsg,
        updatedAt: new Date(),
      })
      .where(eq(externalDataCache.id, existing[0].id));
  }
}

// ───── Helpers ─────

function formatAge(seconds: number): string {
  if (seconds < 60) {
    return "just now";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hr ago`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}
