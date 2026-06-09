import { randomUUID } from "node:crypto";
import {
  insertDeadLetterRow,
  deleteDeadLetterRow,
  updateDeadLetterRetry,
  deleteDeadLetterOlderThan,
  deleteDeadLetterQueue,
  selectDeadLetterRows,
} from "../../db/telemetry-dead-letter/queries";
import type { DeadLetterEntry, DeadLetterQueueMetrics } from "./types";
import { logger } from "../../utils/logger";

const inMemoryStore: Map<string, DeadLetterEntry[]> = new Map();

/**
 * P2 #19 — Persistent DLQ storage. Historically every entry lived
 * only in `inMemoryStore`, so a process restart silently dropped
 * every queued failure: the data was lost, the metrics counter
 * still showed nothing, and operators had no replay handle. We now
 * write-through to the `telemetry_dead_letter` table (already
 * present in the schema and used as a generic store keyed by
 * `queue_name`) as a fire-and-forget side effect on every
 * mutating call. The in-memory map remains the hot read path —
 * sync API is unchanged — so callers don't have to await DB I/O on
 * the failure-handling hot path. On startup `hydrateFromDatabase()`
 * reloads the surviving rows so replay handlers can see them.
 *
 * Persistence is best-effort: a DB outage degrades us back to
 * pre-#19 behaviour (in-memory only, lost on restart) instead of
 * propagating the failure to the caller, who is already in an
 * error path. Errors are logged but never thrown.
 */
const PERSISTENCE_DISABLED =
  process.env["DLQ_PERSISTENCE_DISABLED"] === "true" ||
  process.env["LOCAL_MODE"] === "true" ||
  process.env["EMBEDDED_MODE"] === "true";

function persistAdd(queueName: string, entry: DeadLetterEntry): void {
  if (PERSISTENCE_DISABLED) {
    return;
  }
  void insertDeadLetterRow({
    id: entry.id,
    queueName,
    payload: entry.payload,
    error: entry.error,
    source: entry.source,
    retryCount: entry.retryCount,
    metadata: entry.metadata ?? null,
    createdAt: entry.createdAt,
    lastRetryAt: entry.lastRetryAt,
  }).catch((err: unknown) => {
    logger.warn("DLQ", "Failed to persist dead-letter entry", {
      queueName,
      entryId: entry.id,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

function persistRemove(queueName: string, id: string): void {
  if (PERSISTENCE_DISABLED) {
    return;
  }
  void deleteDeadLetterRow(queueName, id).catch((err: unknown) => {
    logger.warn("DLQ", "Failed to delete persisted dead-letter entry", {
      queueName,
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

function persistRetryBump(queueName: string, entry: DeadLetterEntry): void {
  if (PERSISTENCE_DISABLED) {
    return;
  }
  void updateDeadLetterRetry(queueName, entry.id, entry.retryCount, entry.lastRetryAt).catch(
    (err: unknown) => {
      logger.warn("DLQ", "Failed to persist retry bump", {
        queueName,
        id: entry.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  );
}

function persistClearOlder(queueName: string, cutoff: Date): void {
  if (PERSISTENCE_DISABLED) {
    return;
  }
  void deleteDeadLetterOlderThan(queueName, cutoff).catch((err: unknown) => {
    logger.warn("DLQ", "Failed to prune persisted dead-letter rows", {
      queueName,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

function persistClearQueue(queueName: string): void {
  if (PERSISTENCE_DISABLED) {
    return;
  }
  void deleteDeadLetterQueue(queueName).catch((err: unknown) => {
    logger.warn("DLQ", "Failed to clear persisted dead-letter queue", {
      queueName,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Hydrate the in-memory store for a queue from the persistent
 * table. Safe to call multiple times — re-loading the same queue
 * resets the in-memory state to whatever's in the DB. Returns the
 * number of entries reloaded (0 on DB error so callers can log).
 */
export async function hydrateFromDatabase(queueName: string): Promise<number> {
  if (PERSISTENCE_DISABLED) {
    return 0;
  }
  try {
    const rows = await selectDeadLetterRows(queueName);
    const entries: DeadLetterEntry[] = rows.map((row) => ({
      id: row.id,
      payload: row.payload as unknown,
      error: row.error,
      source: row.source,
      createdAt: row.createdAt,
      retryCount: row.retryCount,
      lastRetryAt: row.lastRetryAt,
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : undefined,
    }));
    inMemoryStore.set(queueName, entries);
    return entries.length;
  } catch (err) {
    logger.warn("DLQ", "Failed to hydrate dead-letter queue from database", {
      queueName,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

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
  persistAdd(queueName, entry as DeadLetterEntry);
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
    persistRemove(queueName, id);
    return true;
  }
  return false;
}

export function incrementRetry(queueName: string, id: string): void {
  const entry = getEntry(queueName, id);
  if (entry) {
    entry.retryCount++;
    entry.lastRetryAt = new Date();
    persistRetryBump(queueName, entry);
  }
}

export function listEntries(
  queueName: string,
  options: {
    limit?: number | undefined;
    offset?: number | undefined;
    source?: string | undefined;
  } = {}
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

  if (originalLength !== filtered.length) {
    persistClearOlder(queueName, cutoff);
  }
  return originalLength - filtered.length;
}

export function clearQueue(queueName: string): number {
  const queue = getQueue(queueName);
  const count = queue.length;
  inMemoryStore.set(queueName, []);
  if (count > 0) {
    persistClearQueue(queueName);
  }
  return count;
}
