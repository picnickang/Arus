/**
 * Daily telemetry retention processor.
 *
 * Wraps server/db-utils/retention.ts#applyTelemetryRetention, which
 * drops whole expired monthly partitions first (when equipment_telemetry
 * is partitioned) and then deletes remaining expired rows in bounded
 * batches per org under withTenantContext.
 *
 * Defense in depth for a destructive job: TELEMETRY_RETENTION_ENABLED
 * ("false" disables) gates execution on top of the subsystem-wide
 * ENABLE_BACKGROUND_JOBS flag. Scheduled at 03:30 UTC — after the 02:00
 * warehouse export, so exports never race deletes (and retention only
 * touches rows older than the policy window, ≥365 days by default,
 * while the export ships yesterday's rollups).
 */

import { createLogger } from "../lib/structured-logger";
import { applyTelemetryRetention, type RetentionResult } from "../db-utils/retention.js";

const logger = createLogger("JobProcessors:TelemetryRetention");

export async function processTelemetryRetention(): Promise<RetentionResult> {
  if (process.env["TELEMETRY_RETENTION_ENABLED"] === "false") {
    logger.info("Telemetry retention disabled via TELEMETRY_RETENTION_ENABLED=false — skipping");
    return {
      success: true,
      deletedRecords: 0,
      message: "Retention disabled via TELEMETRY_RETENTION_ENABLED=false",
    };
  }

  const result = await applyTelemetryRetention();
  logger.info("Telemetry retention run finished", { ...result });

  if (!result.success) {
    // Re-throw so pg-boss retries once (retryLimit: 1 on the schedule).
    throw new Error(result.message);
  }
  return result;
}
