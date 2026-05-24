/**
 * Feature Flag Overrides — Schema Migration (Wave 0.6)
 *
 * Persistent overrides for the `FeatureFlagManager`. Resolution order at
 * call time is:
 *
 *   user-specific override  >  tenant-specific override  >  global override
 *                          >  env-var override (existing)  >  static default
 *
 * Scope semantics:
 *   - tenant_id NULL,  user_id NULL    → global override (highest broad-scope)
 *   - tenant_id SET,   user_id NULL    → tenant-wide override
 *   - tenant_id SET,   user_id SET     → single-user override (most specific)
 *
 * The uniqueness key uses COALESCE(...,'') so a single (flag, scope) tuple
 * can have at most one row, regardless of whether `tenant_id`/`user_id` are
 * NULL — without this, NULLs would always be considered distinct and
 * upserts/conflict checks would silently insert duplicates.
 */

import { sql, type SQL } from "drizzle-orm";

export async function migrateFeatureFlagOverrides(
  db: { execute: (q: SQL<unknown>) => Promise<unknown> }
): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS feature_flag_overrides (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      flag_key TEXT NOT NULL,
      tenant_id TEXT,
      user_id TEXT,
      enabled BOOLEAN NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_feature_flag_overrides_scope
      ON feature_flag_overrides (
        flag_key,
        COALESCE(tenant_id, ''),
        COALESCE(user_id, '')
      );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_flag
      ON feature_flag_overrides (flag_key);
  `);

  await db.execute(sql`
    COMMENT ON TABLE feature_flag_overrides IS
      'Per-tenant / per-user feature flag overrides. NULL tenant_id/user_id widens scope. See server/infrastructure/feature-flags.ts for resolution order.';
  `);
}
