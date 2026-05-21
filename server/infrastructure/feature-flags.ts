import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Infrastructure:FeatureFlags");
/**
 * Feature Flags for Tenant-Scoped Repository Migration
 *
 * Allows gradual rollout of ADR 001 implementation with safe rollback.
 * Each domain can be migrated independently with real-time monitoring.
 */

export interface FeatureFlags {
  // Tenant-scoped repository rollout flags
  useTenantScopedEquipment: boolean;
  useTenantScopedWorkOrders: boolean;
  useTenantScopedCrew: boolean;
  useTenantScopedInventory: boolean;
  useTenantScopedAnalytics: boolean;

  // Safety flags
  enableTenantIsolationLogging: boolean;
  enableTenantIsolationMetrics: boolean;
  strictTenantValidation: boolean; // Throw on isolation violations vs log

  // Scheduling system flags (SmartPAL-style overhaul)
  newSchedulerEnabled: boolean; // Master toggle for new scheduling UI
  enableSchedulingTelemetry: boolean; // Log scheduling operations for comparison
  enableSchedulingSettings: boolean; // Enable admin scheduling settings UI
  enableAiSuggestions: boolean; // Enable AI-powered crew suggestions
  enableScheduleGenerator: boolean; // Enable Schedule Generator (AI-powered auto-scheduling)
}

/**
 * Per-(tenant, user) override loaded from the `feature_flag_overrides` DB
 * table. Resolution order in `isEnabledFor(flag, ctx)` is:
 *
 *   user-specific  >  tenant-specific  >  global  >  env-var  >  static default
 *
 * The cache is a snapshot loaded by `refresh(db)`; lookups are sync so
 * call sites do not need to become async. If the DB is unreachable, the
 * cache stays empty and resolution falls through to env-var / default —
 * matching the graceful-degradation pattern used elsewhere in the app.
 */
interface FlagOverrideRow {
  flag_key: string;
  tenant_id: string | null;
  user_id: string | null;
  enabled: boolean;
}

export interface FlagContext {
  tenantId?: string | null;
  userId?: string | null;
}

export class FeatureFlagManager {
  private flags: FeatureFlags;

  // Override cache keyed by flag_key. Each entry holds rows sorted by
  // specificity (most-specific first) so the resolver does at most one
  // .find() per call.
  private overrideCache = new Map<string, FlagOverrideRow[]>();
  private refreshPromise: Promise<void> | null = null;
  private autoRefreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize from environment variables
    this.flags = {
      // Domain migration flags (default: true for equipment after Phase 2B completion)
      useTenantScopedEquipment: this.parseEnvFlag("USE_TENANT_SCOPED_EQUIPMENT", true),
      useTenantScopedWorkOrders: this.parseEnvFlag("USE_TENANT_SCOPED_WORK_ORDERS", false),
      useTenantScopedCrew: this.parseEnvFlag("USE_TENANT_SCOPED_CREW", false),
      useTenantScopedInventory: this.parseEnvFlag("USE_TENANT_SCOPED_INVENTORY", false),
      useTenantScopedAnalytics: this.parseEnvFlag("USE_TENANT_SCOPED_ANALYTICS", false),

      // Safety flags (default: true for observability)
      enableTenantIsolationLogging: this.parseEnvFlag("ENABLE_TENANT_ISOLATION_LOGGING", true),
      enableTenantIsolationMetrics: this.parseEnvFlag("ENABLE_TENANT_ISOLATION_METRICS", true),
      strictTenantValidation: this.parseEnvFlag("STRICT_TENANT_VALIDATION", false),

      // Scheduling system flags (SmartPAL-style overhaul)
      newSchedulerEnabled: this.parseEnvFlag("NEW_SCHEDULER_ENABLED", false),
      enableSchedulingTelemetry: this.parseEnvFlag("ENABLE_SCHEDULING_TELEMETRY", true),
      enableSchedulingSettings: this.parseEnvFlag("ENABLE_SCHEDULING_SETTINGS", false),
      enableAiSuggestions: this.parseEnvFlag("ENABLE_AI_SUGGESTIONS", false),
      enableScheduleGenerator: this.parseEnvFlag("ENABLE_SCHEDULE_GENERATOR", false),
    };
  }

  /**
   * Parse boolean environment variable
   */
  private parseEnvFlag(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) {
      return defaultValue;
    }
    return value === "true" || value === "1";
  }

  /**
   * Get all feature flags
   */
  public getFlags(): Readonly<FeatureFlags> {
    return { ...this.flags };
  }

  /**
   * Check if a specific flag is enabled
   */
  public isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag];
  }

  /**
   * Enable a flag at runtime (for testing)
   */
  public enable(flag: keyof FeatureFlags): void {
    this.flags[flag] = true;
  }

  /**
   * Disable a flag at runtime (for rollback)
   */
  public disable(flag: keyof FeatureFlags): void {
    this.flags[flag] = false;
  }

  /**
   * Resolve a flag for a specific tenant/user context. Reads the in-memory
   * override cache (populated by `refresh(db)`); falls through to the
   * env-var/static value returned by `isEnabled` if no override matches.
   *
   * Resolution: user-specific > tenant-specific > global > env/default.
   *
   * This stays synchronous so existing call sites can opt in incrementally
   * without an async cascade. Callers that need fresh DB state should
   * `await featureFlags.refresh(db)` before the lookup.
   */
  public isEnabledFor(flag: keyof FeatureFlags, ctx: FlagContext = {}): boolean {
    const rows = this.overrideCache.get(flag as string);
    if (rows && rows.length > 0) {
      const { tenantId = null, userId = null } = ctx;
      // Rows are pre-sorted most-specific-first by refresh().
      for (const row of rows) {
        const userMatch = row.user_id === null || row.user_id === userId;
        const tenantMatch = row.tenant_id === null || row.tenant_id === tenantId;
        // A user-scoped row requires both userId and tenantId to match
        // (or the row's tenant_id to be NULL meaning "any tenant").
        // A tenant-scoped row (user_id NULL) requires tenant to match.
        // A global row (both NULL) matches anything.
        if (userMatch && tenantMatch) {
          return row.enabled;
        }
      }
    }
    return this.isEnabled(flag);
  }

  /**
   * Reload the override cache from the `feature_flag_overrides` table.
   * Idempotent and safe to call concurrently — concurrent callers share
   * the same in-flight promise.
   *
   * `db` is the drizzle handle used elsewhere in the app. If the query
   * fails (table missing, DB unreachable, …) the cache is left in its
   * previous state and a single warn is logged — the resolver simply
   * falls through to env defaults.
   */
  public async refresh(db: any): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      try {
        const { sql } = await import("drizzle-orm");
        const result = (await db.execute(sql`
          SELECT flag_key, tenant_id, user_id, enabled
          FROM feature_flag_overrides
        `)) as object as { rows?: FlagOverrideRow[] } | FlagOverrideRow[];
        const rows: FlagOverrideRow[] = Array.isArray(result)
          ? (result as FlagOverrideRow[])
          : (result.rows ?? []);

        const next = new Map<string, FlagOverrideRow[]>();
        for (const row of rows) {
          const list = next.get(row.flag_key) ?? [];
          list.push(row);
          next.set(row.flag_key, list);
        }
        // Sort each list most-specific-first: rows with both ids set come
        // before tenant-only, which come before global. Stable ordering
        // matters because the resolver picks the first match.
        const specificity = (r: FlagOverrideRow) =>
          (r.user_id !== null ? 2 : 0) + (r.tenant_id !== null ? 1 : 0);
        for (const list of next.values()) {
          list.sort((a, b) => specificity(b) - specificity(a));
        }
        this.overrideCache = next;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Feature-flag override refresh failed (using env defaults): ${msg}`);
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  /**
   * Start a periodic background refresh of the override cache. Returns a
   * stop function. If called more than once, the previous timer is
   * cleared first so callers cannot accidentally stack timers.
   */
  public startAutoRefresh(db: any, intervalMs = 60_000): () => void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
    // unref so this timer never blocks Node from exiting.
    this.autoRefreshTimer = setInterval(() => {
      void this.refresh(db);
    }, intervalMs);
    this.autoRefreshTimer.unref?.();
    return () => {
      if (this.autoRefreshTimer) {
        clearInterval(this.autoRefreshTimer);
        this.autoRefreshTimer = null;
      }
    };
  }

  /**
   * Inspection helper for the admin/health surface — exposes the current
   * cache without leaking internal mutability.
   */
  public getOverridesSnapshot(): Record<string, FlagOverrideRow[]> {
    const out: Record<string, FlagOverrideRow[]> = {};
    for (const [k, v] of this.overrideCache) {
      out[k] = v.map((r) => ({ ...r }));
    }
    return out;
  }

  /**
   * Get migration progress percentage
   */
  public getMigrationProgress(): number {
    const migrationFlags: (keyof FeatureFlags)[] = [
      "useTenantScopedEquipment",
      "useTenantScopedWorkOrders",
      "useTenantScopedCrew",
      "useTenantScopedInventory",
      "useTenantScopedAnalytics",
    ];

    const enabledCount = migrationFlags.filter((flag) => this.flags[flag]).length;
    return (enabledCount / migrationFlags.length) * 100;
  }
}

/**
 * Global feature flag instance
 */
export const featureFlags = new FeatureFlagManager();

/**
 * Tenant isolation event logger
 * Tracks all tenant boundary crossings for audit
 */
export class TenantIsolationLogger {
  /**
   * Log successful tenant isolation enforcement
   */
  static logSuccess(context: {
    domain: string;
    operation: string;
    orgId: string;
    resourceId?: string;
  }): void {
    if (!featureFlags.isEnabled("enableTenantIsolationLogging")) {
      return;
    }

    logger.info("[TENANT_ISOLATION_SUCCESS]", {
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  /**
   * Log tenant isolation violation attempt
   */
  static logViolation(context: {
    domain: string;
    operation: string;
    requestedOrgId: string;
    actualOrgId: string;
    resourceId?: string;
    userId?: string;
  }): void {
    if (!featureFlags.isEnabled("enableTenantIsolationLogging")) {
      return;
    }

    logger.error("[TENANT_ISOLATION_VIOLATION]", undefined, {
      timestamp: new Date().toISOString(),
      severity: "CRITICAL",
      ...context,
    });

    // In strict mode, also throw an error
    if (featureFlags.isEnabled("strictTenantValidation")) {
      throw new Error(
        `Tenant isolation violation: User from org ${context.requestedOrgId} ` +
          `attempted to access resource from org ${context.actualOrgId}`
      );
    }
  }

  /**
   * Log migration fallback (when new pattern fails, falls back to legacy)
   */
  static logFallback(context: {
    domain: string;
    operation: string;
    orgId: string;
    error: string;
  }): void {
    if (!featureFlags.isEnabled("enableTenantIsolationLogging")) {
      return;
    }

    logger.warn("[TENANT_MIGRATION_FALLBACK]", {
      timestamp: new Date().toISOString(),
      ...context,
    });
  }
}

/**
 * Tenant isolation metrics collector
 * Tracks performance and reliability of tenant-scoped repositories
 */
export class TenantIsolationMetrics {
  private static counters = new Map<string, number>();

  /**
   * Increment a metric counter
   */
  static increment(metric: string, labels?: Record<string, string>): void {
    if (!featureFlags.isEnabled("enableTenantIsolationMetrics")) {
      return;
    }

    const key = labels
      ? `${metric}:${Object.entries(labels)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : metric;

    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + 1);
  }

  /**
   * Track repository operation timing
   */
  static async trackOperation<T>(
    domain: string,
    operation: string,
    orgId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!featureFlags.isEnabled("enableTenantIsolationMetrics")) {
      return fn();
    }

    const startTime = Date.now();
    let success = false;

    try {
      const result = await fn();
      success = true;
      return result;
    } finally {
      const duration = Date.now() - startTime;

      this.increment("tenant_repository_operations", {
        domain,
        operation,
        status: success ? "success" : "error",
      });

      logger.debug("[TENANT_METRICS]", { details: {
        domain,
        operation,
        orgId,
        duration,
        success,
      } });
    }
  }

  /**
   * Get all metrics
   */
  static getMetrics(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  /**
   * Reset all metrics (for testing)
   */
  static reset(): void {
    this.counters.clear();
  }
}
