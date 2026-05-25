/**
 * Telemetry Warehouse Export — orchestrator.
 *
 * Public entry point: `runTelemetryWarehouseExport()` runs the full daily
 * pipeline (previous-day Parquet export per org → manifest update →
 * retention prune). Callable from the pg-boss daily cron and from an
 * admin trigger endpoint for ad-hoc back-fills.
 *
 * Tenant isolation is enforced two ways:
 *   1. Each Parquet file holds rows for exactly one orgId, queried with
 *      `WHERE org_id = $1`.
 *   2. The partition key includes `orgId=<orgId>/`, so even an enumeration
 *      bug downstream cannot conflate two tenants' files.
 */

import { db } from "../../db";
import { createLogger } from "../../lib/structured-logger";
import {
  exportOrgDayToParquet,
  listOrgIdsWithRollups,
} from "./parquet-exporter";
import { loadManifest, mergeEntry, saveManifest } from "./manifest";
import { pruneOldExports } from "./retention";
import { recordRun } from "./last-run";
import { previousUtcDate, dateStrToUtcStart } from "./date-utils";
import type {
  WarehouseExportJobSummary,
  WarehouseExportRunSummary,
} from "./types";

const logger = createLogger("TelemetryWarehouseExport");

export interface RunOptions {
  /** UTC date to export. Defaults to "yesterday" relative to `now`. */
  date?: string | undefined;
  /** Limit to a specific list of orgIds (useful for back-fills). */
  orgIds?: string[] | undefined;
  /** Override "now" for tests. */
  now?: Date | undefined;
}

export async function runTelemetryWarehouseExport(
  options: RunOptions = {},
): Promise<WarehouseExportJobSummary> {
  const start = Date.now();
  const now = options.now ?? new Date();

  const { dayStart, dateStr } = options.date
    ? { dayStart: dateStrToUtcStart(options.date), dateStr: options.date }
    : previousUtcDate(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  logger.info("Starting telemetry warehouse export", {
    date: dateStr,
    orgIdsOverride: options.orgIds?.length ?? null,
  });

  let orgIds: string[];
  try {
    orgIds = options.orgIds && options.orgIds.length > 0
      ? options.orgIds
      : await listOrgIdsWithRollups(db, dayStart, dayEnd);
  } catch (err) {
    logger.error("Failed to enumerate orgs with rollups — aborting export", {
      date: dateStr,
      error: err instanceof Error ? err.message : String(err),
    });
    const summary: WarehouseExportJobSummary = {
      date: dateStr,
      orgsTotal: 0,
      orgsExported: 0,
      orgsSkipped: 0,
      orgsFailed: 0,
      rowsExported: 0,
      bytesExported: 0,
      retentionDeleted: 0,
      durationMs: Date.now() - start,
      perOrg: [],
    };
    await recordRun(summary);
    return summary;
  }

  const perOrg: WarehouseExportRunSummary[] = [];
  let orgsExported = 0;
  let orgsSkipped = 0;
  let orgsFailed = 0;
  let rowsExported = 0;
  let bytesExported = 0;

  for (const orgId of orgIds) {
    const result = await exportOrgDayToParquet({
      db,
      orgId,
      dayStart,
      dateStr,
    });
    perOrg.push(result);

    if (result.status === "exported" && result.parquetKey) {
      orgsExported += 1;
      rowsExported += result.rowCount;
      bytesExported += result.sizeBytes;
      try {
        const manifest = await loadManifest(orgId);
        const merged = mergeEntry(manifest, {
          date: result.date,
          parquetKey: result.parquetKey,
          rowCount: result.rowCount,
          exportedAt: result.finishedAt,
          sizeBytes: result.sizeBytes,
        });
        await saveManifest(merged);
      } catch (err) {
        logger.warn("Manifest update failed after export", {
          orgId,
          date: dateStr,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (result.status === "skipped-empty") {
      orgsSkipped += 1;
    } else {
      orgsFailed += 1;
    }
  }

  let retentionDeleted = 0;
  try {
    const r = await pruneOldExports(now);
    retentionDeleted = r.objectsDeleted;
  } catch (err) {
    logger.warn("Retention prune failed (continuing)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const summary: WarehouseExportJobSummary = {
    date: dateStr,
    orgsTotal: orgIds.length,
    orgsExported,
    orgsSkipped,
    orgsFailed,
    rowsExported,
    bytesExported,
    retentionDeleted,
    durationMs: Date.now() - start,
    perOrg,
  };

  if (orgsFailed > 0) {
    logger.warn("Telemetry warehouse export finished with failures", {
      date: summary.date,
      orgsTotal: summary.orgsTotal,
      orgsExported,
      orgsSkipped,
      orgsFailed,
      rowsExported,
      bytesExported,
      retentionDeleted,
      durationMs: summary.durationMs,
    });
  } else {
    logger.info("Telemetry warehouse export complete", {
      date: dateStr,
      orgsTotal: summary.orgsTotal,
      orgsExported,
      orgsSkipped,
      rowsExported,
      bytesExported,
      retentionDeleted,
      durationMs: summary.durationMs,
    });
  }

  await recordRun(summary);
  return summary;
}

export { getRecentRuns } from "./last-run";
export { loadManifest } from "./manifest";
export { previousUtcDate } from "./date-utils";
export type {
  WarehouseExportEntry,
  WarehouseExportJobSummary,
  WarehouseExportRunSummary,
  WarehouseManifest,
} from "./types";
