import type { HealthCollector, ComponentHealth, HealthStatus } from "../types";

interface BatchWriterMetricsProvider {
  getStats(): {
    bufferSize: number;
    totalQueued: number;
    totalFlushed: number;
    totalEvicted: number;
    totalErrors: number;
    totalDropped: number;
    isRunning: boolean;
    avgFlushDurationMs: number;
  };
}

export class BatchWriterHealthCollector implements HealthCollector {
  name = "telemetry-batch-writer";
  private metricsProvider: BatchWriterMetricsProvider | null = null;

  setMetricsProvider(provider: BatchWriterMetricsProvider): void {
    this.metricsProvider = provider;
  }

  async collect(): Promise<ComponentHealth> {
    if (!this.metricsProvider) {
      return {
        name: this.name,
        status: "unknown",
        message: "Metrics provider not configured",
        lastCheck: new Date(),
      };
    }

    const stats = this.metricsProvider.getStats();
    let status: HealthStatus = "healthy";
    let message = "Operating normally";

    if (!stats.isRunning) {
      status = "unhealthy";
      message = "Batch writer is not running";
    } else if (stats.totalDropped > 0) {
      status = "degraded";
      message = `${stats.totalDropped} readings dropped after max retries`;
    } else if (stats.totalEvicted > stats.totalFlushed * 0.1) {
      status = "degraded";
      message = "High eviction rate detected";
    } else if (stats.avgFlushDurationMs > 1000) {
      status = "degraded";
      message = `Slow flush times (avg: ${stats.avgFlushDurationMs}ms)`;
    }

    return {
      name: this.name,
      status,
      message,
      lastCheck: new Date(),
      metrics: {
        bufferSize: stats.bufferSize,
        totalQueued: stats.totalQueued,
        totalFlushed: stats.totalFlushed,
        totalEvicted: stats.totalEvicted,
        totalErrors: stats.totalErrors,
        totalDropped: stats.totalDropped,
        avgFlushDurationMs: stats.avgFlushDurationMs,
      },
    };
  }
}

export const batchWriterHealthCollector = new BatchWriterHealthCollector();
