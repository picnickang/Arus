import client from "prom-client";
import { structuredLog } from "../logging";
import {
  checkResourceUsage,
  MEMORY_CHECK_INTERVAL,
  startEventLoopMonitoring,
} from "./core-metrics";
import {
  syncExternalCircuitBreakerMetrics,
  setExternalCircuitBreakerState,
  recordExternalCircuitBreakerFailure,
  recordExternalServiceCall,
  recordExternalServiceLatency,
} from "./circuit-breaker-metrics";
import { initializeServiceMetrics } from "./service-metrics";

export function initializeMetrics() {
  if (
    process.env["DISABLE_OBSERVABILITY_TIMERS"] === "true" ||
    process.env["NODE_ENV"] === "test"
  ) {
    structuredLog("info", "Observability timers disabled", {
      operation: "startup",
      metadata: { reason: "test-mode" },
    });
    return;
  }

  client.collectDefaultMetrics({
    prefix: "arus_",
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  });

  initializeServiceMetrics().catch((err) => {
    structuredLog("warn", "Service metrics initialization error", {
      error: { message: String(err) },
    });
  });

  try {
    const { circuitBreaker } = require("../error-handling");
    circuitBreaker.setMetricsCallbacks({
      onStateChange: setExternalCircuitBreakerState,
      onFailure: recordExternalCircuitBreakerFailure,
      onCall: recordExternalServiceCall,
      onLatency: recordExternalServiceLatency,
    });
  } catch (error) {}

  structuredLog("info", "Observability metrics initialized", {
    operation: "startup",
    metadata: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  });

  setInterval(checkResourceUsage, MEMORY_CHECK_INTERVAL);
  setInterval(() => syncExternalCircuitBreakerMetrics(), 30000);
  startEventLoopMonitoring();
}
