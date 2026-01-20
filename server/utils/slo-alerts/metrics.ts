/**
 * SLO Alerts - Prometheus Metrics
 */

import client from "prom-client";

export const sloViolationsGauge = new client.Gauge({
  name: "arus_slo_violations",
  help: "Number of active SLO violations (0 = healthy, 1 = violation)",
  labelNames: ["slo_name", "metric", "severity"],
});

export const sloLatencyGauge = new client.Gauge({
  name: "arus_slo_latency_budget_remaining",
  help: "Remaining latency error budget (1 = 100% remaining, 0 = exhausted)",
  labelNames: ["slo_name", "percentile"],
});

export const sloErrorBudgetGauge = new client.Gauge({
  name: "arus_slo_error_budget_remaining",
  help: "Remaining error budget (1 = 100% remaining, 0 = exhausted)",
  labelNames: ["slo_name"],
});

export const sloBurnRateGauge = new client.Gauge({
  name: "arus_slo_burn_rate",
  help: "Current error budget burn rate (1 = burning at budget rate, >1 = burning faster)",
  labelNames: ["slo_name"],
});

export const sloAvailabilityGauge = new client.Gauge({
  name: "arus_slo_availability",
  help: "Current availability (1 = 100%, 0.999 = 99.9%)",
  labelNames: ["slo_name"],
});

export const activeViolationKeys = new Set<string>();

export function clearViolationGauge(sloName: string, metric: string): void {
  const key = `${sloName}:${metric}`;
  if (activeViolationKeys.has(key)) {
    sloViolationsGauge.set({ slo_name: sloName, metric, severity: "warning" }, 0);
    sloViolationsGauge.set({ slo_name: sloName, metric, severity: "critical" }, 0);
    activeViolationKeys.delete(key);
  }
}

export function setViolationGauge(sloName: string, metric: string, severity: string): void {
  const key = `${sloName}:${metric}`;
  activeViolationKeys.add(key);
  sloViolationsGauge.set({ slo_name: sloName, metric, severity }, 1);
  const otherSeverity = severity === "warning" ? "critical" : "warning";
  sloViolationsGauge.set({ slo_name: sloName, metric, severity: otherSeverity }, 0);
}
