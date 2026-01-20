import type { TelemetryReading } from '../../telemetry-batch-writer';

export interface DeadLetterEntry<T = unknown> {
  id: string;
  payload: T;
  error: string;
  source: string;
  retryCount: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ITelemetryPersistence {
  writeBatch(readings: TelemetryReading[]): Promise<void>;
  checkIdempotency(key: string): Promise<boolean>;
  markIdempotent(key: string): Promise<void>;
}

export interface IDeadLetterQueue<T = unknown> {
  add(payload: T, error: string, source: string, metadata?: Record<string, unknown>): DeadLetterEntry<T>;
  get(id: string): DeadLetterEntry<T> | undefined;
  list(options?: { limit?: number; offset?: number; source?: string }): DeadLetterEntry<T>[];
  replay(id: string): Promise<{ success: boolean; entryId: string; error?: string }>;
  replayAll(options?: { source?: string; limit?: number }): Promise<{ success: boolean; entryId: string; error?: string }[]>;
  prune(): number;
  clear(): number;
  getMetrics(): DeadLetterQueueMetrics;
}

export interface DeadLetterQueueMetrics {
  totalEntries: number;
  totalAdded: number;
  totalReplayed: number;
  totalFailed: number;
  oldestEntryAge: number | null;
}

export interface IMetricsEmitter {
  incFramesRead(count: number): void;
  incReadingsDecoded(count: number): void;
  incValidationFailed(count: number): void;
  incBatchCommitted(count: number): void;
  observeCommitLatency(ms: number): void;
  observeEndToEndLag(ms: number): void;
  setBacklog(count: number): void;
  setBackoff(ms: number): void;
  incRetries(): void;
  incDLQAdded(source: string): void;
}

export interface ITelemetryRawFrameSource<T = unknown> {
  fetchBatch(afterId: number, limit: number): T[];
  getMaxId(): number;
  getLagFrames(cursorLastId: number): number;
}

export interface ICursorStore {
  getCursor(): { lastId: number; lastTs: number };
  setCursor(lastId: number, lastTs: number): void;
}
