import client from "prom-client";

// ===== PERFORMANCE: Event Loop Lag Monitoring =====
export const eventLoopLag = new client.Histogram({
  name: "arus_event_loop_lag_ms",
  help: "Event loop lag in milliseconds (time between scheduled and actual execution)",
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
});

export const eventLoopLagCurrent = new client.Gauge({
  name: "arus_event_loop_lag_current_ms",
  help: "Current event loop lag in milliseconds",
});

let eventLoopMonitorId: NodeJS.Timeout | null = null;
let eventLoopMonitorStartTime: number = 0;
const WARMUP_PERIOD_MS = 30_000;

export function startEventLoopMonitoring(intervalMs: number = 1000): void {
  if (eventLoopMonitorId) { return; }
  eventLoopMonitorStartTime = Date.now();

  const measure = () => {
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      eventLoopLag.observe(lag);
      eventLoopLagCurrent.set(lag);
      
      const timeSinceStart = Date.now() - eventLoopMonitorStartTime;
      const isWarmingUp = timeSinceStart < WARMUP_PERIOD_MS;
      
      if (lag > 100 && !isWarmingUp) {
        console.warn(`[Performance] Event loop lag: ${lag}ms (threshold: 100ms)`);
      } else if (lag > 500 && isWarmingUp) {
        console.log(`[Performance] Startup event loop lag: ${lag}ms (warm-up period, expected)`);
      }
    });
  };

  eventLoopMonitorId = setInterval(measure, intervalMs);
  console.log(`[Performance] Event loop monitoring started (interval: ${intervalMs}ms, warm-up: ${WARMUP_PERIOD_MS / 1000}s)`);
}

export function stopEventLoopMonitoring(): void {
  if (eventLoopMonitorId) {
    clearInterval(eventLoopMonitorId);
    eventLoopMonitorId = null;
    console.log("[Performance] Event loop monitoring stopped");
  }
}

// ===== DATABASE METRICS =====
export const databaseConnectionsTotal = new client.Gauge({
  name: "arus_database_connections_active",
  help: "Active database connections",
});

export const databaseQueryDuration = new client.Histogram({
  name: "arus_database_query_duration_seconds",
  help: "Database query execution time",
  labelNames: ["operation", "table"],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
});

export const databaseErrorsTotal = new client.Counter({
  name: "arus_database_errors_total",
  help: "Total database operation errors",
  labelNames: ["operation", "error_type"],
});

// ===== RANGE QUERY METRICS =====
export const rangeQueriesTotal = new client.Counter({
  name: "arus_range_queries_total",
  help: "Total range queries executed",
  labelNames: ["query_type", "vessel_id"],
});

export const rangeQueryDuration = new client.Histogram({
  name: "arus_range_query_duration_seconds",
  help: "Range query execution time",
  labelNames: ["query_type"],
  buckets: [0.01, 0.1, 0.5, 1, 2, 5, 10],
});

// ===== MEMORY MONITORING =====
export const PERFORMANCE_THRESHOLDS = {
  SLOW_REQUEST_MS: 2000,
  HIGH_MEMORY_MB: 512,
  CRITICAL_MEMORY_MB: 768,
} as const;

const MEMORY_CHECK_INTERVAL = 60000;
let lastMemoryWarningTime = 0;
const MEMORY_WARNING_COOLDOWN = 300000;

export function checkResourceUsage(): void {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  
  if (heapUsedMB > PERFORMANCE_THRESHOLDS.CRITICAL_MEMORY_MB) {
    const now = Date.now();
    if (now - lastMemoryWarningTime > MEMORY_WARNING_COOLDOWN) {
      lastMemoryWarningTime = now;
      console.warn(`[Performance] CRITICAL: High memory usage - ${heapUsedMB.toFixed(0)}MB (threshold: ${PERFORMANCE_THRESHOLDS.CRITICAL_MEMORY_MB}MB)`);
      if (global.gc) {
        console.log("[Performance] Triggering garbage collection...");
        global.gc();
      }
    }
  }
}

export { MEMORY_CHECK_INTERVAL };

// Backward-compatible aliases
export function recordDatabaseQuery(operation: string, table: string, durationMs: number) {
  databaseQueryDuration.observe({ operation, table }, durationMs / 1000);
}

export function incrementDatabaseError(operation: string, errorType: string) {
  databaseErrorsTotal.inc({ operation, error_type: errorType });
}

export function incrementRangeQuery(queryType: string, vesselId?: string) {
  rangeQueriesTotal.inc({ query_type: queryType, vessel_id: vesselId || "unknown" });
}

export function recordRangeQueryDuration(queryType: string, durationMs: number) {
  rangeQueryDuration.observe({ query_type: queryType }, durationMs / 1000);
}
