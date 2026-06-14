import { batchWriterFlushDuration, batchWriterFlushSize } from "./telemetry-batch-writer-metrics";
import { filterOverQuotaReadings, incrementQuotaUsage } from "./telemetry-batch-writer-quota";
import type {
  BatchWriterInternalStats,
  TelemetryBatchReading,
} from "./telemetry-batch-writer-types";

type EmitFn = (eventName: string, payload: unknown) => void;

interface WriteBatchContext {
  stats: BatchWriterInternalStats;
  emit: EmitFn;
  writeToDatabase: (readings: TelemetryBatchReading[]) => Promise<void>;
  isFaultInjectionEnabled: () => boolean;
  faultInjectionError: Error;
}

export async function writeTelemetryBatchDirect(
  readings: TelemetryBatchReading[],
  options: { source: string },
  context: WriteBatchContext
): Promise<void> {
  const isProduction = process.env["NODE_ENV"] === "production";

  if (isProduction && options.source !== "sqlite-bridge") {
    throw new Error(
      `Source guard violation: Only 'sqlite-bridge' source is allowed in production. Got: '${options.source}'`
    );
  }

  if (readings.length === 0) {
    return;
  }

  if (context.isFaultInjectionEnabled()) {
    context.stats.totalErrors++;
    throw context.faultInjectionError;
  }

  const startTime = Date.now();

  const allowedReadings = await filterOverQuotaReadings(readings, (totalDropped, droppedPerOrg) => {
    context.stats.totalDropped += totalDropped;
    context.emit("quotaBlocked", {
      total: totalDropped,
      perOrg: Object.fromEntries(droppedPerOrg),
    });
  });

  if (allowedReadings.length === 0) {
    context.emit("batchWritten", {
      count: 0,
      durationMs: Date.now() - startTime,
      source: options.source,
      droppedForQuota: readings.length,
    });
    return;
  }

  try {
    await context.writeToDatabase(allowedReadings);

    const duration = Date.now() - startTime;
    context.stats.totalFlushed += allowedReadings.length;
    context.stats.lastFlushTime = new Date();
    context.stats.lastFlushDurationMs = duration;
    context.stats.lastFlushCount = allowedReadings.length;

    context.stats.flushDurations.push(duration);
    if (context.stats.flushDurations.length > 100) {
      context.stats.flushDurations.shift();
    }

    batchWriterFlushDuration.observe({ status: "success" }, duration);
    batchWriterFlushSize.observe(allowedReadings.length);

    const batchId = options.source ?? "unknown";
    await incrementQuotaUsage(allowedReadings, batchId);

    context.emit("batchWritten", {
      count: allowedReadings.length,
      durationMs: duration,
      source: options.source,
      droppedForQuota: readings.length - allowedReadings.length,
    });
  } catch (err) {
    context.stats.totalErrors++;
    batchWriterFlushDuration.observe({ status: "error" }, Date.now() - startTime);
    throw err;
  }
}
