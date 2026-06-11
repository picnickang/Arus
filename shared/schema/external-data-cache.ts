import { sql, pgTable, text, varchar, integer, timestamp, jsonb, index } from "./base";
import { organizations } from "./core";

/**
 * Cache for external API responses.
 *
 * When the vessel has satellite connectivity, external tools fetch fresh data
 * and upsert it here.  When offline, tools read from this cache and return
 * the last-known value with a staleness indicator.
 *
 * Rows are keyed by (org_id, provider, cache_key) so the same endpoint can
 * store multiple scoped results (e.g. weather per-vessel, parts per-SKU).
 */
export const externalDataCache = pgTable(
  "external_data_cache",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    /** Source identifier: 'weather', 'regulatory', 'parts', 'ais', etc. */
    provider: text("provider").notNull(),
    /** Scoped lookup key, e.g. vessel-id, part-number, regulation-id. */
    cacheKey: text("cache_key").notNull(),
    /** The cached response payload. */
    data: jsonb("data").notNull(),
    /** HTTP status or provider-specific status of the last fetch. */
    fetchStatus: text("fetch_status").notNull().default("ok"),
    /** Human-readable error if the last fetch failed. */
    fetchError: text("fetch_error"),
    /** When the data was last successfully refreshed from the external source. */
    fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow(),
    /** Optional TTL hint in seconds — consumers decide whether to treat stale data as usable. */
    ttlSeconds: integer("ttl_seconds").default(3600),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => [
    index("idx_ext_cache_org_provider_key").on(table.orgId, table.provider, table.cacheKey),
    index("idx_ext_cache_fetched_at").on(table.fetchedAt),
  ]
);

export type ExternalDataCacheRecord = typeof externalDataCache.$inferSelect;
