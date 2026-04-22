/**
 * Data Reconciliation - Prometheus Metrics
 */

import { Counter, Gauge, Histogram } from "prom-client";

export const reconciliationMetrics = {
  validationRuns: new Counter({
    name: "data_reconciliation_runs_total",
    help: "Total number of data reconciliation runs",
    labelNames: ["orgId", "type"],
  }),

  issuesDetected: new Counter({
    name: "data_reconciliation_issues_detected_total",
    help: "Total number of data quality issues detected",
    labelNames: ["orgId", "issueType", "severity"],
  }),

  dataQualityScore: new Gauge({
    name: "data_quality_score",
    help: "Overall data quality score (0-1)",
    labelNames: ["orgId", "dataType"],
  }),

  reconciliationDuration: new Histogram({
    name: "data_reconciliation_duration_seconds",
    help: "Duration of data reconciliation operations",
    labelNames: ["operation"],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),

  orphanedRecords: new Gauge({
    name: "orphaned_records_count",
    help: "Number of orphaned records detected",
    labelNames: ["orgId", "recordType"],
  }),
};
