/**
 * Schedule Planner Read Model - Prometheus Metrics
 * Observability metrics for CQRS read model operations
 */

import client from "prom-client";

export const schedulePlannerViewLatency = new client.Histogram({
  name: "arus_schedule_planner_view_latency_seconds",
  help: "Latency of schedule planner view queries in seconds",
  labelNames: ["org_id", "operation"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const schedulePlannerRefreshLatency = new client.Histogram({
  name: "arus_schedule_planner_refresh_latency_seconds",
  help: "Latency of read model refresh operations in seconds",
  labelNames: ["org_id", "triggered_by"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

export const schedulePlannerEventProcessingLatency = new client.Histogram({
  name: "arus_schedule_planner_event_processing_latency_seconds",
  help: "Latency of domain event processing in seconds",
  labelNames: ["event_type"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
});

export const schedulePlannerCacheHits = new client.Counter({
  name: "arus_schedule_planner_cache_hits_total",
  help: "Total number of cache hits for schedule planner queries",
  labelNames: ["org_id"],
});

export const schedulePlannerCacheMisses = new client.Counter({
  name: "arus_schedule_planner_cache_misses_total",
  help: "Total number of cache misses for schedule planner queries",
  labelNames: ["org_id"],
});

export const schedulePlannerEventsProcessed = new client.Counter({
  name: "arus_schedule_planner_events_processed_total",
  help: "Total number of domain events processed by read model",
  labelNames: ["event_type", "status"],
});

export const schedulePlannerRowCount = new client.Gauge({
  name: "arus_schedule_planner_row_count",
  help: "Current number of rows in the schedule planner view",
  labelNames: ["org_id"],
});

export const schedulePlannerViolationCount = new client.Gauge({
  name: "arus_schedule_planner_violation_count",
  help: "Current number of schedule violations detected",
  labelNames: ["org_id", "violation_type", "severity"],
});

export const schedulePlannerComplianceRate = new client.Gauge({
  name: "arus_schedule_planner_compliance_rate",
  help: "Current compliance rate (0-100)",
  labelNames: ["org_id"],
});

export const schedulePlannerUtilization = new client.Gauge({
  name: "arus_schedule_planner_utilization_rate",
  help: "Current crew utilization rate (0-100)",
  labelNames: ["org_id"],
});

export const schedulePlannerDebounceSkipped = new client.Counter({
  name: "arus_schedule_planner_debounce_skipped_total",
  help: "Number of refresh requests skipped due to debouncing",
  labelNames: ["org_id"],
});

export function recordViewQuery(orgId: string, operation: string, durationMs: number): void {
  schedulePlannerViewLatency.observe({ org_id: orgId, operation }, durationMs / 1000);
}

export function recordRefresh(orgId: string, triggeredBy: string, durationMs: number): void {
  schedulePlannerRefreshLatency.observe(
    { org_id: orgId, triggered_by: triggeredBy },
    durationMs / 1000
  );
}

export function recordEventProcessing(
  eventType: string,
  durationMs: number,
  success: boolean
): void {
  schedulePlannerEventProcessingLatency.observe({ event_type: eventType }, durationMs / 1000);
  schedulePlannerEventsProcessed.inc({
    event_type: eventType,
    status: success ? "success" : "error",
  });
}

export function recordCacheHit(orgId: string): void {
  schedulePlannerCacheHits.inc({ org_id: orgId });
}

export function recordCacheMiss(orgId: string): void {
  schedulePlannerCacheMisses.inc({ org_id: orgId });
}

export function recordDebounceSkip(orgId: string): void {
  schedulePlannerDebounceSkipped.inc({ org_id: orgId });
}

export function updateViewStats(
  orgId: string,
  rowCount: number,
  complianceRate: number,
  utilization: number,
  violations: Array<{ type: string; severity: string }>
): void {
  schedulePlannerRowCount.set({ org_id: orgId }, rowCount);
  schedulePlannerComplianceRate.set({ org_id: orgId }, complianceRate);
  schedulePlannerUtilization.set({ org_id: orgId }, utilization);

  const violationCounts = new Map<string, number>();
  for (const v of violations) {
    const key = `${v.type}:${v.severity}`;
    violationCounts.set(key, (violationCounts.get(key) || 0) + 1);
  }

  violationCounts.forEach((count, key) => {
    const [type, severity] = key.split(":");
    schedulePlannerViolationCount.set({ org_id: orgId, violation_type: type, severity }, count);
  });
}
