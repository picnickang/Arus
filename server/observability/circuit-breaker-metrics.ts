import client from "prom-client";

// ===== EXTERNAL SERVICE CIRCUIT BREAKER METRICS =====
export const externalCircuitBreakerState = new client.Gauge({
  name: "arus_external_circuit_breaker_state",
  help: "External service circuit breaker state (0=closed, 1=open, 2=half-open)",
  labelNames: ["service"],
});

export const externalCircuitBreakerFailures = new client.Counter({
  name: "arus_external_circuit_breaker_failures_total",
  help: "Total failures recorded by external circuit breakers",
  labelNames: ["service"],
});

export const externalServiceLatency = new client.Histogram({
  name: "arus_external_service_latency_seconds",
  help: "External service call latency in seconds",
  labelNames: ["service", "operation"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const externalServiceCallsTotal = new client.Counter({
  name: "arus_external_service_calls_total",
  help: "Total external service calls",
  labelNames: ["service", "status"],
});

// ===== DEPENDENCY HEALTH METRICS =====
export const dependencyHealthStatus = new client.Gauge({
  name: "arus_dependency_health_status",
  help: "Dependency health status (1=healthy, 0=unhealthy)",
  labelNames: ["dependency"],
});

// Helper functions
export function setExternalCircuitBreakerState(service: string, state: 0 | 1 | 2) {
  externalCircuitBreakerState.set({ service }, state);
}

export function recordExternalCircuitBreakerFailure(service: string) {
  externalCircuitBreakerFailures.inc({ service });
}

export function recordExternalServiceLatency(
  service: string,
  operation: string,
  durationMs: number
) {
  externalServiceLatency.observe({ service, operation }, durationMs / 1000);
}

export function recordExternalServiceCall(
  service: string,
  status: "success" | "failure" | "circuit_open"
) {
  externalServiceCallsTotal.inc({ service, status });
}

export function setDependencyHealthStatus(dependency: string, status: 0 | 1) {
  dependencyHealthStatus.set({ dependency }, status);
}

export async function syncExternalCircuitBreakerMetrics() {
  try {
    const { getAllCircuitBreakerStatuses } = await import("../services/external-circuit-breakers");
    const externalStatuses = getAllCircuitBreakerStatuses();
    for (const [service, status] of Object.entries(externalStatuses)) {
      const state = status.state === "OPEN" ? 1 : status.state === "HALF_OPEN" ? 2 : 0;
      setExternalCircuitBreakerState(service, state as 0 | 1 | 2);
    }

    const cbModule: any = await import("../ml-circuit-breaker");
    const circuitBreakerRegistry: any = cbModule.circuitBreakerRegistry ?? cbModule.default ?? {};
    const mlStatuses = (circuitBreakerRegistry.getAllStats?.() ?? {}) as Record<string, any>;
    for (const [modelName, stats] of Object.entries(mlStatuses)) {
      const { setMlCircuitBreakerState } = await import("./ml-metrics");
      const modelType = modelName.replace("ml_", "") as
        | "lstm"
        | "random_forest"
        | "xgboost"
        | "ensemble";
      const state = stats.state === "OPEN" ? 1 : stats.state === "HALF_OPEN" ? 2 : 0;
      setMlCircuitBreakerState(modelType, state as 0 | 1 | 2);
    }
  } catch {
    // Silently ignore if modules not loaded yet
  }
}
