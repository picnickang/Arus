/**
 * Telemetry Warehouse Export Prometheus metrics (LR-2).
 *
 * The export orchestrator in
 * `server/services/telemetry-warehouse-export/index.ts` already emits
 * a structured-log summary and writes a `_recent-runs.json` ring
 * buffer for the admin status endpoint, but neither is scrapeable by
 * the on-call's Prometheus / alerting stack. This module is the
 * scrape-friendly counterpart — a single counter per outcome, plus a
 * gauge for the rows-exported total so dashboards can see "we exported
 * N rows for date D" at a glance.
 *
 * Cardinality is intentionally bounded:
 *   - `date` (YYYY-MM-DD) is bounded by retention (the manifest only
 *     keeps recent days; old labels naturally roll off as the process
 *     restarts).
 *   - There is NO `org_id` label here on purpose — per-tenant cardinality
 *     would explode for fleet operators with hundreds of orgs, and the
 *     orchestrator already aggregates org counts into the summary. If
 *     per-tenant export visibility is needed for SLOs later, gate it
 *     behind a `LR2_WAREHOUSE_PER_ORG_METRICS` env flag.
 *
 * The success counter name is locked by the LR-2 contract:
 *   `arus_telemetry_warehouse_export_success_total{date}`
 */

import client from "prom-client";

/**
 * Successful per-day exports. Incremented exactly once per
 * `runTelemetryWarehouseExport` invocation that completed with
 * `orgsFailed === 0` (including no-op runs where `orgsTotal === 0`,
 * which are still a healthy outcome — there was simply no telemetry
 * to export for that day).
 */
export const warehouseExportSuccessTotal = new client.Counter({
  name: "arus_telemetry_warehouse_export_success_total",
  help: "Total telemetry warehouse export runs that completed without org-level failures, labelled by the UTC date the run covered.",
  labelNames: ["date"],
});

/**
 * Per-day failed runs. Incremented exactly once per invocation where
 * at least one org failed to export OR where the orchestrator itself
 * could not enumerate orgs (a harness-level failure). The orchestrator
 * already records per-org failures in the run summary; this counter
 * is the binary "did the day succeed?" signal alerting hangs off.
 */
export const warehouseExportFailureTotal = new client.Counter({
  name: "arus_telemetry_warehouse_export_failure_total",
  help: "Total telemetry warehouse export runs that finished with at least one org-level failure or a harness error, labelled by the UTC date the run covered.",
  labelNames: ["date"],
});

/**
 * Rows exported on the most recent run for a given date. Set (not
 * incremented) so reruns/back-fills overwrite rather than double-count.
 * Useful for dashboards ("yesterday we exported N rows"); not used
 * for alerting because back-fills legitimately reset it.
 */
export const warehouseExportRowsGauge = new client.Gauge({
  name: "arus_telemetry_warehouse_export_rows",
  help: "Rows written by the most recent telemetry warehouse export run for the labelled UTC date.",
  labelNames: ["date"],
});

/**
 * Bytes written on the most recent run for a given date. Same set-not-
 * inc semantics as the rows gauge.
 */
export const warehouseExportBytesGauge = new client.Gauge({
  name: "arus_telemetry_warehouse_export_bytes",
  help: "Bytes written by the most recent telemetry warehouse export run for the labelled UTC date.",
  labelNames: ["date"],
});

/**
 * Wall-clock duration of the most recent run for a given date.
 */
export const warehouseExportDurationGauge = new client.Gauge({
  name: "arus_telemetry_warehouse_export_duration_ms",
  help: "Wall-clock duration in ms of the most recent telemetry warehouse export run for the labelled UTC date.",
  labelNames: ["date"],
});

export interface WarehouseExportOutcome {
  date: string;
  orgsFailed: number;
  rowsExported: number;
  bytesExported: number;
  durationMs: number;
}

/**
 * Record the outcome of a single `runTelemetryWarehouseExport`
 * invocation. Idempotent w.r.t. the gauges (set semantics) and
 * mutually-exclusive w.r.t. the counters (exactly one of
 * success / failure fires per call).
 */
export function recordWarehouseExportOutcome(outcome: WarehouseExportOutcome): void {
  const { date, orgsFailed, rowsExported, bytesExported, durationMs } = outcome;

  if (orgsFailed === 0) {
    warehouseExportSuccessTotal.inc({ date });
  } else {
    warehouseExportFailureTotal.inc({ date });
  }

  warehouseExportRowsGauge.set({ date }, rowsExported);
  warehouseExportBytesGauge.set({ date }, bytesExported);
  warehouseExportDurationGauge.set({ date }, durationMs);
}
