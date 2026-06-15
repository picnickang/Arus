export interface TelemetryBatchReading {
  equipmentId: string;
  sensorType: string;
  value: number;
  timestamp: Date;
  deviceId?: string;
  orgId?: string;
  unit?: string;
  metadata?: Record<string, unknown>;
  _retryCount?: number;
}

export interface BatchWriterStats {
  bufferSize: number;
  totalQueued: number;
  totalFlushed: number;
  totalEvicted: number;
  totalErrors: number;
  totalDropped: number;
  lastFlushTime: Date | null;
  lastFlushDurationMs: number;
  lastFlushCount: number;
  avgFlushDurationMs: number;
  isRunning: boolean;
}

export interface BatchWriterConfig {
  batchIntervalMs: number;
  maxBufferSize: number;
  evictionPercent: number;
  flushOnShutdown: boolean;
  maxRetries: number;
  dbInsertChunkSize: number;
}

export interface BatchWriterInternalStats {
  totalQueued: number;
  totalFlushed: number;
  totalEvicted: number;
  totalErrors: number;
  totalDropped: number;
  lastFlushTime: Date | null;
  lastFlushDurationMs: number;
  lastFlushCount: number;
  flushDurations: number[];
}
