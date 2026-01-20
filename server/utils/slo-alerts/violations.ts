/**
 * SLO Alerts - Violation Checking
 */

import type { SLOConfig, SLOViolation } from "./types.js";
import { loadSLOConfigs, customSLOs } from "./config.js";
import { routeBuckets, getWindowBuckets, calculatePercentile, calculateBurnRate } from "./calculations.js";
import { activeViolationKeys, clearViolationGauge, setViolationGauge, sloLatencyGauge, sloErrorBudgetGauge, sloBurnRateGauge, sloAvailabilityGauge } from "./metrics.js";

const recentViolations: SLOViolation[] = [];
const MAX_VIOLATIONS = 100;

type ViolationSeverity = "warning" | "critical";

function createViolation(
  sloName: string,
  metric: string,
  threshold: number,
  actual: number,
  route: string,
  severity: ViolationSeverity,
  burnRate?: number
): SLOViolation {
  return { sloName, metric, threshold, actual, route, timestamp: new Date(), severity, burnRate };
}

function checkLatencyViolations(
  slo: SLOConfig,
  route: string,
  p50: number,
  p95: number,
  p99: number,
  violations: SLOViolation[],
  currentViolationKeys: Set<string>
): void {
  if (p50 > slo.latencyP50Ms) {
    currentViolationKeys.add(`${slo.name}:latency_p50`);
    const severity: ViolationSeverity = p50 > slo.latencyP50Ms * 2 ? "critical" : "warning";
    violations.push(createViolation(slo.name, "latency_p50", slo.latencyP50Ms, p50, route, severity));
    setViolationGauge(slo.name, "latency_p50", severity);
  }

  if (p95 > slo.latencyP95Ms) {
    currentViolationKeys.add(`${slo.name}:latency_p95`);
    const severity: ViolationSeverity = p95 > slo.latencyP95Ms * 2 ? "critical" : "warning";
    violations.push(createViolation(slo.name, "latency_p95", slo.latencyP95Ms, p95, route, severity));
    setViolationGauge(slo.name, "latency_p95", severity);
  }

  if (p99 > slo.latencyP99Ms) {
    currentViolationKeys.add(`${slo.name}:latency_p99`);
    violations.push(createViolation(slo.name, "latency_p99", slo.latencyP99Ms, p99, route, "critical"));
    setViolationGauge(slo.name, "latency_p99", "critical");
  }
}

function checkAvailabilityViolations(
  slo: SLOConfig,
  route: string,
  availability: number,
  burnRate: number,
  violations: SLOViolation[],
  currentViolationKeys: Set<string>
): void {
  const errorBudget = 1 - slo.availabilityTarget;

  if (availability < slo.availabilityTarget) {
    currentViolationKeys.add(`${slo.name}:error_rate`);
    const severity: ViolationSeverity = availability < (slo.availabilityTarget - errorBudget) ? "critical" : "warning";
    violations.push(createViolation(slo.name, "error_rate", slo.availabilityTarget, availability, route, severity, burnRate));
    setViolationGauge(slo.name, "error_rate", severity);
  }

  if (burnRate > 10) {
    currentViolationKeys.add(`${slo.name}:error_budget`);
    violations.push(createViolation(slo.name, "error_budget", 10, burnRate, route, "critical", burnRate));
    setViolationGauge(slo.name, "error_budget", "critical");
  }
  else if (burnRate > 2) {
    currentViolationKeys.add(`${slo.name}:error_budget`);
    violations.push(createViolation(slo.name, "error_budget", 2, burnRate, route, "warning", burnRate));
    setViolationGauge(slo.name, "error_budget", "warning");
  }
}

function updateMetricsGauges(
  slo: SLOConfig,
  p50: number,
  p95: number,
  p99: number,
  availability: number,
  burnRate: number
): void {
  const errorBudget = 1 - slo.availabilityTarget;

  sloLatencyGauge.set({ slo_name: slo.name, percentile: "p50" }, Math.max(0, 1 - p50 / slo.latencyP50Ms));
  sloLatencyGauge.set({ slo_name: slo.name, percentile: "p95" }, Math.max(0, 1 - p95 / slo.latencyP95Ms));
  sloLatencyGauge.set({ slo_name: slo.name, percentile: "p99" }, Math.max(0, 1 - p99 / slo.latencyP99Ms));

  const errorBudgetRemaining = Math.max(0, (availability - slo.availabilityTarget) / errorBudget + 1);
  sloErrorBudgetGauge.set({ slo_name: slo.name }, Math.min(1, errorBudgetRemaining));
  sloBurnRateGauge.set({ slo_name: slo.name }, burnRate);
  sloAvailabilityGauge.set({ slo_name: slo.name }, availability);
}

function clearResolvedViolations(currentViolationKeys: Set<string>): void {
  for (const key of activeViolationKeys) {
    if (!currentViolationKeys.has(key)) {
      const [sloName, metric] = key.split(":");
      clearViolationGauge(sloName, metric);
    }
  }
}

function logViolations(violations: SLOViolation[]): void {
  for (const violation of violations) {
    recentViolations.push(violation);
    if (recentViolations.length > MAX_VIOLATIONS) { recentViolations.shift(); }
    const burnInfo = violation.burnRate ? `, burn rate: ${violation.burnRate.toFixed(2)}x` : "";
    console.warn(`[SLO VIOLATION] ${violation.sloName}: ${violation.metric} = ${violation.actual.toFixed(3)} (threshold: ${violation.threshold})${burnInfo} on ${violation.route}`);
  }
}

function processRouteForSLO(
  slo: SLOConfig,
  route: string,
  violations: SLOViolation[],
  currentViolationKeys: Set<string>
): void {
  const buckets = routeBuckets.get(route);
  if (!buckets) { return; }

  const windowBuckets = getWindowBuckets(buckets, slo.windowMinutes);
  if (windowBuckets.length < 3) { return; }

  const allLatencies: number[] = [];
  let totalCount = 0, errorCount = 0;

  for (const bucket of windowBuckets) {
    allLatencies.push(...bucket.latencies);
    totalCount += bucket.totalCount;
    errorCount += bucket.errorCount;
  }

  if (totalCount < 10) { return; }

  const availability = (totalCount - errorCount) / totalCount;
  const burnRate = calculateBurnRate(availability, slo.availabilityTarget);
  const p50 = calculatePercentile(allLatencies, 50);
  const p95 = calculatePercentile(allLatencies, 95);
  const p99 = calculatePercentile(allLatencies, 99);

  checkLatencyViolations(slo, route, p50, p95, p99, violations, currentViolationKeys);
  checkAvailabilityViolations(slo, route, availability, burnRate, violations, currentViolationKeys);
  updateMetricsGauges(slo, p50, p95, p99, availability, burnRate);
}

export function checkSLOViolations(slos?: SLOConfig[]): SLOViolation[] {
  const sloConfigs = slos || [...loadSLOConfigs(), ...customSLOs];
  const violations: SLOViolation[] = [];
  const currentViolationKeys = new Set<string>();

  for (const slo of sloConfigs) {
    for (const [route] of routeBuckets) {
      if (!route.startsWith(slo.routePattern)) { continue; }
      processRouteForSLO(slo, route, violations, currentViolationKeys);
    }
  }

  clearResolvedViolations(currentViolationKeys);
  logViolations(violations);

  return violations;
}

export function getRecentViolations(): SLOViolation[] {
  return [...recentViolations];
}

export { recentViolations };
