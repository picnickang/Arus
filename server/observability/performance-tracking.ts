import { structuredLog, type LogContext } from "../logging";

// Performance thresholds for alerting
const OPERATION_THRESHOLDS: Record<string, number> = {
  http_request: 2000,
  database_query: 500,
  telemetry_batch: 1000,
  mqtt_publish: 200,
  ml_prediction: 5000,
  rul_calculation: 10000,
  health_check: 1000,
  default: 1000,
};

export function trackPerformance(
  operationType: string,
  durationMs: number,
  context?: Partial<LogContext>
): void {
  const threshold = OPERATION_THRESHOLDS[operationType] || OPERATION_THRESHOLDS.default;
  
  if (durationMs > threshold) {
    structuredLog("warn", `Slow ${operationType}: ${durationMs}ms (threshold: ${threshold}ms)`, {
      operation: operationType,
      duration: durationMs,
      ...context,
    });
  }
}

export function trackDatabaseQuery(
  operation: string,
  table: string,
  durationMs: number,
  rowCount?: number
): void {
  if (durationMs > OPERATION_THRESHOLDS.database_query) {
    structuredLog("warn", `Slow DB query: ${operation} on ${table} - ${durationMs}ms`, {
      operation: "database_query",
      duration: durationMs,
      metadata: { table, operation, rowCount },
    });
  }
}

export function trackBatchOperation(
  operationType: string,
  batchSize: number,
  durationMs: number
): void {
  const perItemMs = batchSize > 0 ? durationMs / batchSize : 0;
  
  if (durationMs > 5000 || perItemMs > 100) {
    structuredLog("warn", `Slow batch ${operationType}: ${batchSize} items in ${durationMs}ms`, {
      operation: operationType,
      duration: durationMs,
      metadata: { batchSize, perItemMs: perItemMs.toFixed(2) },
    });
  }
}
