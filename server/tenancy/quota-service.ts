/**
 * Push B1 step 6 — Per-tenant resource quotas.
 *
 * Quotas are advisory soft-throttles backed by a hard-throttle cliff:
 *   - <80% used → green, no header.
 *   - 80%-99%  → soft warn; response carries `X-Tenant-Quota-Warning`.
 *   - ≥100%    → hard throttle: 429 with `Retry-After`.
 *
 * Three metrics are tracked:
 *   - `storage_bytes`       (instantaneous; aggregated nightly)
 *   - `equipment_count`     (instantaneous; aggregated nightly)
 *   - `telemetry_rows_today`(per-UTC-day rolling counter)
 *
 * The service deliberately reads quotas + usage straight from Postgres —
 * caching belongs at the middleware layer once we measure read pressure.
 * For now correctness > throughput, especially because RLS already
 * intercedes if a query forgets `WHERE org_id`.
 */

import { sql } from "drizzle-orm";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Tenancy:QuotaService");

export type QuotaMetric =
  | "storage_bytes"
  | "equipment_count"
  | "telemetry_rows_today";

export interface QuotaCheck {
  metric: QuotaMetric;
  limit: number;
  used: number;
  /** 0..>1 ratio of used/limit. */
  ratio: number;
  /** `true` once `used >= limit`. */
  exceeded: boolean;
  /** `true` once `ratio >= 0.8` and not exceeded. */
  warning: boolean;
  /** Seconds until the per-day window rolls over. 0 for instantaneous metrics. */
  retryAfterSeconds: number;
}

const DEFAULTS: Record<QuotaMetric, number> = {
  storage_bytes: 10 * 1024 * 1024 * 1024,
  equipment_count: 5000,
  telemetry_rows_today: 10_000_000,
};

const COL_FOR: Record<QuotaMetric, string> = {
  storage_bytes: "max_storage_bytes",
  equipment_count: "max_equipment_count",
  telemetry_rows_today: "max_telemetry_rows_per_day",
};

function secondsUntilNextUtcMidnight(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  );
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function todayWindowDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SqlExecutor {
  execute(query: unknown): Promise<unknown>;
}

export class QuotaService {
  // The executor is injectable so unit tests can capture the SQL handed
  // to the database without depending on a live Postgres. Production
  // callers go through the `quotaService` singleton below, which lazily
  // binds to the real `db` on first use — keeping db-config off the
  // module-graph hot path for tests that exercise this class directly.
  private resolved: SqlExecutor | null;

  constructor(executor?: SqlExecutor) {
    this.resolved = executor ?? null;
  }

  private async executor(): Promise<SqlExecutor> {
    if (!this.resolved) {
      const mod = await import("../db-config");
      this.resolved = mod.db as unknown as SqlExecutor;
    }
    return this.resolved;
  }

  async getLimit(orgId: string, metric: QuotaMetric): Promise<number> {
    try {
      const col = COL_FOR[metric];
      const result: any = await (await this.executor()).execute(
        sql.raw(
          `SELECT ${col} AS limit_value FROM tenant_quotas WHERE org_id = '${orgId.replace(/'/g, "''")}'`
        )
      );
      const rows: any[] = Array.isArray(result) ? result : result?.rows ?? [];
      const v = rows[0]?.limit_value;
      if (typeof v === "string") return Number(v);
      if (typeof v === "number") return v;
    } catch (err: any) {
      // If the table doesn't exist yet (migration not applied), use the
      // built-in defaults rather than crashing the request path.
      logger.warn("tenant_quotas lookup failed; using defaults", {
        orgId,
        metric,
        error: err?.message,
      });
    }
    return DEFAULTS[metric];
  }

  async getUsage(orgId: string, metric: QuotaMetric): Promise<number> {
    const safeOrg = orgId.replace(/'/g, "''");
    const windowDate =
      metric === "telemetry_rows_today" ? todayWindowDate() : "1970-01-01";
    try {
      const result: any = await (await this.executor()).execute(
        sql.raw(
          `SELECT value FROM tenant_usage
             WHERE org_id = '${safeOrg}'
               AND metric = '${metric}'
               AND window_start = '${windowDate}'`
        )
      );
      const rows: any[] = Array.isArray(result) ? result : result?.rows ?? [];
      const v = rows[0]?.value;
      if (typeof v === "string") return Number(v);
      if (typeof v === "number") return v;
    } catch (err: any) {
      logger.warn("tenant_usage lookup failed; assuming 0", {
        orgId,
        metric,
        error: err?.message,
      });
    }
    return 0;
  }

  async incrementUsage(
    orgId: string,
    metric: QuotaMetric,
    delta: number
  ): Promise<void> {
    if (!Number.isFinite(delta) || delta === 0) return;
    const safeOrg = orgId.replace(/'/g, "''");
    const windowDate =
      metric === "telemetry_rows_today" ? todayWindowDate() : "1970-01-01";
    try {
      // Clamp the stored value at 0. Negative deltas (e.g. KB document
      // deletes from task #89) must still shrink the counter when there
      // is headroom — they just must never let it drift below zero, so
      // a racing / double-fired / replayed decrement cannot silently
      // widen the tenant's effective quota.
      //
      // Two clamps, both required:
      //   - VALUES (...) : a first-ever insert with a negative delta
      //     lands at 0 rather than a negative starting value.
      //   - DO UPDATE    : applies the raw signed delta against the
      //     existing row and clamps the result, so a -5 against a
      //     value of 10 lands at 5 (not at 10, which is what using
      //     EXCLUDED.value here would produce — EXCLUDED.value is
      //     the already-clamped 0 from the VALUES branch).
      const truncated = Math.trunc(delta);
      await (await this.executor()).execute(
        sql.raw(
          `INSERT INTO tenant_usage (org_id, metric, window_start, value)
             VALUES ('${safeOrg}', '${metric}', '${windowDate}', GREATEST(0, ${truncated}))
           ON CONFLICT (org_id, metric, window_start)
             DO UPDATE SET value = GREATEST(0, tenant_usage.value + (${truncated})),
                           recorded_at = now()`
        )
      );
    } catch (err: any) {
      logger.warn("tenant_usage increment failed", {
        orgId,
        metric,
        error: err?.message,
      });
    }
  }

  async check(orgId: string, metric: QuotaMetric): Promise<QuotaCheck> {
    const [limit, used] = await Promise.all([
      this.getLimit(orgId, metric),
      this.getUsage(orgId, metric),
    ]);
    const ratio = limit > 0 ? used / limit : 0;
    return {
      metric,
      limit,
      used,
      ratio,
      exceeded: used >= limit && limit > 0,
      warning: ratio >= 0.8 && !(used >= limit && limit > 0),
      retryAfterSeconds:
        metric === "telemetry_rows_today" ? secondsUntilNextUtcMidnight() : 0,
    };
  }
}

export const quotaService = new QuotaService();
