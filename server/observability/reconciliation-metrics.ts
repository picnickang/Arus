import client from "prom-client";

// ===== DATA RECONCILIATION METRICS =====
export const reconciliationRunsTotal = new client.Counter({
  name: "arus_reconciliation_runs_total",
  help: "Total data reconciliation runs",
  labelNames: ["result"],
});

export const reconciliationDuration = new client.Histogram({
  name: "arus_reconciliation_duration_seconds",
  help: "Data reconciliation run duration",
  buckets: [1, 5, 15, 30, 60, 120, 300, 600],
});

export const reconciliationDiscrepanciesFound = new client.Gauge({
  name: "arus_reconciliation_discrepancies_found",
  help: "Number of data discrepancies found in last reconciliation",
  labelNames: ["entity_type"],
});

export const reconciliationDiscrepanciesFixed = new client.Counter({
  name: "arus_reconciliation_discrepancies_fixed_total",
  help: "Total discrepancies automatically fixed",
  labelNames: ["entity_type", "fix_type"],
});

export const dataQualityScore = new client.Gauge({
  name: "arus_data_quality_score",
  help: "Overall data quality score (0-100)",
  labelNames: ["org_id"],
});

// Helper functions
export function recordReconciliationRun(result: "success" | "partial" | "error") {
  reconciliationRunsTotal.inc({ result });
}

export function recordReconciliationDuration(durationSec: number) {
  reconciliationDuration.observe(durationSec);
}

export function setReconciliationDiscrepancies(entityType: string, count: number) {
  reconciliationDiscrepanciesFound.set({ entity_type: entityType }, count);
}

export function recordReconciliationFix(entityType: string, fixType: string) {
  reconciliationDiscrepanciesFixed.inc({ entity_type: entityType, fix_type: fixType });
}

export function setDataQualityScore(orgId: string, score: number) {
  dataQualityScore.set({ org_id: orgId }, score);
}
