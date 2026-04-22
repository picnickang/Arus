import { randomUUID } from "node:crypto";
import type { DeadLetterEntry, DeadLetterQueueMetrics } from "./types";

const inMemoryStore: Map<string, DeadLetterEntry[]> = new Map();

export function getQueue(name: string): DeadLetterEntry[] {
  if (!inMemoryStore.has(name)) {
    inMemoryStore.set(name, []);
  }
  return inMemoryStore.get(name)!;
}

export function addEntry<T>(
  queueName: string,
  payload: T,
  error: string,
  source: string,
  metadata?: Record<string, unknown>
): DeadLetterEntry<T> {
  const queue = getQueue(queueName);
  const entry: DeadLetterEntry<T> = {
    id: randomUUID(),
    payload,
    error,
    source,
    createdAt: new Date(),
    retryCount: 0,
    lastRetryAt: null,
    metadata,
  };
  queue.push(entry);
  return entry;
}

export function getEntry(queueName: string, id: string): DeadLetterEntry | undefined {
  const queue = getQueue(queueName);
  return queue.find((e) => e.id === id);
}

export function removeEntry(queueName: string, id: string): boolean {
  const queue = getQueue(queueName);
  const index = queue.findIndex((e) => e.id === id);
  if (index >= 0) {
    queue.splice(index, 1);
    return true;
  }
  return false;
}

export function incrementRetry(queueName: string, id: string): void {
  const entry = getEntry(queueName, id);
  if (entry) {
    entry.retryCount++;
    entry.lastRetryAt = new Date();
  }
}

export function listEntries(
  queueName: string,
  options: { limit?: number; offset?: number; source?: string } = {}
): DeadLetterEntry[] {
  let queue = getQueue(queueName);

  if (options.source) {
    queue = queue.filter((e) => e.source === options.source);
  }

  const start = options.offset ?? 0;
  const end = options.limit ? start + options.limit : queue.length;

  return queue.slice(start, end);
}

export function getMetrics(queueName: string): DeadLetterQueueMetrics {
  const queue = getQueue(queueName);
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const entriesLast24h = queue.filter((e) => e.createdAt >= oneDayAgo).length;

  const oldest = queue.reduce(
    (min, e) => (!min || e.createdAt < min.createdAt ? e : min),
    null as DeadLetterEntry | null
  );

  const errorCounts = new Map<string, number>();
  for (const entry of queue) {
    errorCounts.set(entry.error, (errorCounts.get(entry.error) ?? 0) + 1);
  }

  const topErrors = Array.from(errorCounts.entries())
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalEntries: queue.length,
    entriesLast24h,
    oldestEntryAge: oldest ? now.getTime() - oldest.createdAt.getTime() : null,
    topErrors,
  };
}

export function clearOldEntries(queueName: string, retentionDays: number): number {
  const queue = getQueue(queueName);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const originalLength = queue.length;
  const filtered = queue.filter((e) => e.createdAt >= cutoff);
  inMemoryStore.set(queueName, filtered);

  return originalLength - filtered.length;
}

export function clearQueue(queueName: string): number {
  const queue = getQueue(queueName);
  const count = queue.length;
  inMemoryStore.set(queueName, []);
  return count;
}
