/**
 * Task #95 — daily warehouse export processor.
 *
 * The cron payload carries no orgId (fleet-wide sweep); the orchestrator
 * enumerates orgs from `telemetry_aggregated` itself and runs an org-scoped
 * export per tenant. Any per-org failure is captured in the per-org summary
 * and surfaced via structured logging — the job itself only re-throws when
 * the orchestrator throws a top-level error so pg-boss can retry.
 */

import { createLogger } from "../lib/structured-logger";
import {
  runTelemetryWarehouseExport,
  type WarehouseExportJobSummary,
} from "../services/telemetry-warehouse-export";

const logger = createLogger("JobProcessors:TelemetryWarehouse");

export interface TelemetryWarehouseJobData {
  /** Optional override of the date (YYYY-MM-DD) — defaults to yesterday. */
  date?: string;
  /** Optional override of orgIds for ad-hoc back-fills. */
  orgIds?: string[];
}

export async function processTelemetryWarehouseExport(
  data: TelemetryWarehouseJobData = {}
): Promise<WarehouseExportJobSummary> {
  logger.info("Telemetry warehouse export job triggered", {
    date: data.date ?? "(yesterday)",
    orgIdsOverride: data.orgIds?.length ?? null,
  });
  return await runTelemetryWarehouseExport({
    date: data.date,
    orgIds: data.orgIds,
  });
}
