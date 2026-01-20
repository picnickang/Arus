export interface DeadLetterEntry<T = unknown> {
  id: string;
  payload: T;
  error: string;
  source: string;
  createdAt: Date;
  retryCount: number;
  lastRetryAt: Date | null;
  metadata?: Record<string, unknown>;
}

export interface DeadLetterQueueConfig {
  maxEntries: number;
  retentionDays: number;
  name: string;
}

export interface DeadLetterQueueMetrics {
  totalEntries: number;
  entriesLast24h: number;
  oldestEntryAge: number | null;
  topErrors: Array<{ error: string; count: number }>;
}

export interface ReplayResult {
  success: boolean;
  entryId: string;
  error?: string;
}
