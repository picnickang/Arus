import { quotaService } from "./tenancy/quota-service";
import {
  batchWriterQuotaBlockedTotal,
  batchWriterQuotaIncrementFailedTotal,
} from "./telemetry-batch-writer-metrics";
import type { TelemetryBatchReading } from "./telemetry-batch-writer-types";
import { withQuotaTimeout } from "./telemetry-batch-writer-quota-timeout";
import { logger } from "./utils/logger";

export async function filterOverQuotaReadings(
  readings: TelemetryBatchReading[],
  onBlocked: (totalDropped: number, droppedPerOrg: Map<string, number>) => void
): Promise<TelemetryBatchReading[]> {
  if (readings.length === 0) {
    return readings;
  }

  const perOrgCounts = new Map<string, number>();
  for (const r of readings) {
    const org = r.orgId || "default-org-id";
    perOrgCounts.set(org, (perOrgCounts.get(org) ?? 0) + 1);
  }

  const overQuotaOrgs = new Set<string>();
  await Promise.all(
    Array.from(perOrgCounts.keys()).map(async (orgId) => {
      try {
        const check = await quotaService.check(orgId, "telemetry_rows_today");
        if (check.exceeded) {
          overQuotaOrgs.add(orgId);
        }
      } catch {
        // Fail-open: a quota-subsystem outage must not halt telemetry ingestion.
      }
    })
  );

  if (overQuotaOrgs.size === 0) {
    return readings;
  }

  const allowed: TelemetryBatchReading[] = [];
  let totalDropped = 0;
  const droppedPerOrg = new Map<string, number>();
  for (const r of readings) {
    const org = r.orgId || "default-org-id";
    if (overQuotaOrgs.has(org)) {
      totalDropped++;
      droppedPerOrg.set(org, (droppedPerOrg.get(org) ?? 0) + 1);
    } else {
      allowed.push(r);
    }
  }

  for (const [org, count] of droppedPerOrg) {
    batchWriterQuotaBlockedTotal.inc({ org_id: org }, count);
  }
  logger.warn(
    "TelemetryBatchWriter",
    `Quota: dropped ${totalDropped} readings across ${droppedPerOrg.size} over-limit org(s)`,
    { perOrg: Object.fromEntries(droppedPerOrg) }
  );
  onBlocked(totalDropped, droppedPerOrg);

  return allowed;
}

export async function incrementQuotaUsage(
  readings: TelemetryBatchReading[],
  batchId: string
): Promise<void> {
  const perOrg = new Map<string, number>();
  for (const r of readings) {
    const org = r.orgId || "default-org-id";
    perOrg.set(org, (perOrg.get(org) ?? 0) + 1);
  }

  await Promise.all(
    Array.from(perOrg.entries()).map(async ([orgId, count]) => {
      try {
        await withQuotaTimeout(quotaService.incrementUsage(orgId, "telemetry_rows_today", count));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const reason = message.startsWith("quota_increment_timeout") ? "timeout" : "error";
        batchWriterQuotaIncrementFailedTotal.inc({ org_id: orgId, reason }, 1);
        logger.warn(
          "TelemetryBatchWriter",
          "Quota increment failed; usage may be undercounted (ingest not blocked)",
          { orgId, batchId, count, reason, error: message }
        );
      }
    })
  );
}
