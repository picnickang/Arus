/**
 * Hourly telemetry rollup processor.
 *
 * The cron payload carries no orgId (fleet-wide sweep). Orgs are
 * enumerated from `organizations` — NOT from `raw_telemetry`, which has
 * FORCE ROW LEVEL SECURITY and would return zero rows to an unpinned
 * fleet-wide read in production. Each org's aggregation runs under
 * withTenantContext so the aggregator's reads of raw_telemetry resolve
 * through the pinned, RLS-scoped connection; writes land in
 * `telemetry_aggregated` (no RLS), the same table the daily warehouse
 * export reads its 1_hour buckets from.
 *
 * runScheduledAggregation's lookback windows (2h minute / 25h hour /
 * 2d day) overlap successive runs, and the upserts are idempotent, so
 * a missed hour self-heals on the next run. Per-org failures are
 * collected, never aborting the sweep — mirroring the warehouse-export
 * orchestrator.
 */

import { createLogger } from "../lib/structured-logger";
import { db } from "../db.js";
import { organizations } from "@shared/schema.js";
import { withTenantContext } from "../middleware/db-context.js";
import { TelemetryAggregator } from "../services/telemetry-aggregation/telemetry-aggregator";

const logger = createLogger("JobProcessors:TelemetryRollup");

export interface TelemetryRollupJobData {
  /** Optional override of orgIds for ad-hoc back-fills. */
  orgIds?: string[];
  /** Lookback for the 1-minute buckets (hours). Defaults to 2. */
  lookbackHours?: number;
}

export interface TelemetryRollupJobSummary {
  orgsTotal: number;
  orgsSucceeded: number;
  orgsFailed: number;
  bucketsCreated: number;
  minuteDeleted: number;
  hourDeleted: number;
  durationMs: number;
  failures: Array<{ orgId: string; error: string }>;
}

export async function processTelemetryRollup(
  data: TelemetryRollupJobData = {},
): Promise<TelemetryRollupJobSummary> {
  const startedAt = Date.now();
  const aggregator = new TelemetryAggregator(db);

  // Idempotent — telemetry_aggregated is runtime-created today (the
  // gap-fill routes IIFE); ensure it exists when this job fires first.
  await aggregator.ensureTable();

  const orgIds =
    data.orgIds && data.orgIds.length > 0
      ? data.orgIds
      : (await db.select({ id: organizations.id }).from(organizations)).map((o) => o.id);

  let bucketsCreated = 0;
  const failures: Array<{ orgId: string; error: string }> = [];

  for (const orgId of orgIds) {
    try {
      const result = await withTenantContext(orgId, () =>
        aggregator.runScheduledAggregation(orgId, data.lookbackHours ?? 2),
      );
      bucketsCreated +=
        result.minute.bucketsCreated + result.hour.bucketsCreated + result.day.bucketsCreated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ orgId, error: message });
      logger.error(`Rollup failed for org ${orgId}`, { error: message });
    }
  }

  // Prune old fine-grained buckets once per sweep (telemetry_aggregated
  // carries no RLS, so this runs unpinned by design).
  const cleanup = await aggregator.cleanupOldAggregations();

  const summary: TelemetryRollupJobSummary = {
    orgsTotal: orgIds.length,
    orgsSucceeded: orgIds.length - failures.length,
    orgsFailed: failures.length,
    bucketsCreated,
    minuteDeleted: cleanup.minuteDeleted,
    hourDeleted: cleanup.hourDeleted,
    durationMs: Date.now() - startedAt,
    failures,
  };

  logger.info("Telemetry rollup sweep finished", { ...summary, failures: undefined });
  return summary;
}
