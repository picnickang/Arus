/**
 * SLO Alerts - Type Definitions
 */

export interface SLOConfig {
  name: string;
  routePattern: string;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  availabilityTarget: number;
  windowMinutes: number;
  bucketMinutes: number;
}

export interface SLOViolation {
  sloName: string;
  metric: "latency_p50" | "latency_p95" | "latency_p99" | "error_rate" | "error_budget";
  threshold: number;
  actual: number;
  route: string;
  timestamp: Date;
  severity: "warning" | "critical";
  burnRate?: number;
}

export interface BucketData {
  minuteStart: number;
  totalCount: number;
  errorCount: number;
  latencies: number[];
}

export interface SLOStatusMetrics {
  p50: number;
  p95: number;
  p99: number;
  availability: number;
  sampleCount: number;
  burnRate: number;
  errorBudgetRemaining: number;
}

export interface SLOStatusConfig {
  windowMinutes: number;
  bucketMinutes: number;
  latencyTargets: { p50: number; p95: number; p99: number };
  availabilityTarget: number;
}

export interface SLOStatusEntry {
  name: string;
  routePattern: string;
  status: "healthy" | "warning" | "critical";
  metrics: SLOStatusMetrics;
  config: SLOStatusConfig;
}

export interface SLOStatusResponse {
  slos: SLOStatusEntry[];
  violations: SLOViolation[];
}
