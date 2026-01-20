import { randomUUID } from 'node:crypto';
import { eq, sql, and, desc } from 'drizzle-orm';
import { db } from '../../db-config';
import { telemetryDeadLetter, type TelemetryDeadLetter, type InsertTelemetryDeadLetter } from '@shared/schema/telemetry';
import type { IDeadLetterQueue, DeadLetterEntry, DeadLetterQueueMetrics } from '../ports/outbound';
import { logger } from '../../utils/logger';
import client from 'prom-client';

const dlqEntriesGauge = new client.Gauge({
  name: 'arus_telemetry_pg_dlq_entries',
  help: 'Total entries in PostgreSQL dead letter queue',
  labelNames: ['queue'],
});

const dlqAddedTotal = new client.Counter({
  name: 'arus_telemetry_pg_dlq_added_total',
  help: 'Total entries added to PostgreSQL DLQ',
  labelNames: ['queue', 'source'],
});

const dlqReplayedTotal = new client.Counter({
  name: 'arus_telemetry_pg_dlq_replayed_total',
  help: 'Total entries replayed from PostgreSQL DLQ',
  labelNames: ['queue', 'status'],
});

export interface PostgresDLQConfig {
  queueName: string;
  maxEntries?: number;
  retentionDays?: number;
}

export class PostgresDeadLetterQueue<T = unknown> implements IDeadLetterQueue<T> {
  private readonly queueName: string;
  private readonly maxEntries: number;
  private readonly retentionDays: number;
  private replayHandler: ((entry: DeadLetterEntry<T>) => Promise<void>) | null = null;

  private totalAdded = 0;
  private totalReplayed = 0;
  private totalFailed = 0;

  constructor(config: PostgresDLQConfig) {
    this.queueName = config.queueName;
    this.maxEntries = config.maxEntries ?? 10000;
    this.retentionDays = config.retentionDays ?? 7;
  }

  setReplayHandler(handler: (entry: DeadLetterEntry<T>) => Promise<void>): void {
    this.replayHandler = handler;
  }

  add(payload: T, error: string, source: string, metadata?: Record<string, unknown>): DeadLetterEntry<T> {
    const id = randomUUID();
    const now = new Date();

    const entry: DeadLetterEntry<T> = {
      id,
      payload,
      error,
      source,
      retryCount: 0,
      createdAt: now,
      metadata,
    };

    db.insert(telemetryDeadLetter)
      .values({
        id,
        queueName: this.queueName,
        payload: payload as any,
        error,
        source,
        retryCount: 0,
        metadata: metadata as any,
      })
      .execute()
      .catch((err: unknown) => {
        logger.error('PostgresDLQ', 'Failed to persist DLQ entry', { error: err, entryId: id });
      });

    this.totalAdded++;
    dlqAddedTotal.inc({ queue: this.queueName, source });
    logger.warn('PostgresDLQ', `Added entry from ${source}`, { entryId: id, error });

    return entry;
  }

  get(id: string): DeadLetterEntry<T> | undefined {
    return undefined;
  }

  async getAsync(id: string): Promise<DeadLetterEntry<T> | undefined> {
    const [row] = await db
      .select()
      .from(telemetryDeadLetter)
      .where(and(eq(telemetryDeadLetter.queueName, this.queueName), eq(telemetryDeadLetter.id, id)));

    if (!row) return undefined;

    return this.rowToEntry(row);
  }

  list(options: { limit?: number; offset?: number; source?: string } = {}): DeadLetterEntry<T>[] {
    return [];
  }

  async listAsync(options: { limit?: number; offset?: number; source?: string } = {}): Promise<DeadLetterEntry<T>[]> {
    const whereConditions = options.source 
      ? and(eq(telemetryDeadLetter.queueName, this.queueName), eq(telemetryDeadLetter.source, options.source))
      : eq(telemetryDeadLetter.queueName, this.queueName);

    let query = db
      .select()
      .from(telemetryDeadLetter)
      .where(whereConditions)
      .orderBy(desc(telemetryDeadLetter.createdAt));

    if (options.limit) {
      query = query.limit(options.limit) as any;
    }
    if (options.offset) {
      query = query.offset(options.offset) as any;
    }

    const rows = await query;
    return rows.map((row: TelemetryDeadLetter) => this.rowToEntry(row));
  }

  async replay(id: string): Promise<{ success: boolean; entryId: string; error?: string }> {
    const entry = await this.getAsync(id);
    if (!entry) {
      return { success: false, entryId: id, error: 'Entry not found' };
    }

    if (!this.replayHandler) {
      return { success: false, entryId: id, error: 'No replay handler configured' };
    }

    try {
      await this.replayHandler(entry);

      await db.delete(telemetryDeadLetter).where(eq(telemetryDeadLetter.id, id));

      this.totalReplayed++;
      dlqReplayedTotal.inc({ queue: this.queueName, status: 'success' });
      logger.info('PostgresDLQ', 'Replayed entry successfully', { entryId: id });

      return { success: true, entryId: id };
    } catch (err) {
      await db
        .update(telemetryDeadLetter)
        .set({
          retryCount: sql`${telemetryDeadLetter.retryCount} + 1`,
          lastRetryAt: new Date(),
        })
        .where(eq(telemetryDeadLetter.id, id));

      this.totalFailed++;
      dlqReplayedTotal.inc({ queue: this.queueName, status: 'failure' });

      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('PostgresDLQ', 'Replay failed', { entryId: id, error: errorMsg });

      return { success: false, entryId: id, error: errorMsg };
    }
  }

  async replayAll(options: { source?: string; limit?: number } = {}): Promise<{ success: boolean; entryId: string; error?: string }[]> {
    const entries = await this.listAsync({ limit: options.limit, source: options.source });
    const results: { success: boolean; entryId: string; error?: string }[] = [];

    for (const entry of entries) {
      if (options.source && entry.source !== options.source) continue;
      results.push(await this.replay(entry.id));
    }

    return results;
  }

  getMetrics(): DeadLetterQueueMetrics {
    return {
      totalEntries: 0,
      totalAdded: this.totalAdded,
      totalReplayed: this.totalReplayed,
      totalFailed: this.totalFailed,
      oldestEntryAge: null,
    };
  }

  async getMetricsAsync(): Promise<DeadLetterQueueMetrics> {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(telemetryDeadLetter)
      .where(eq(telemetryDeadLetter.queueName, this.queueName));

    const oldestResult = await db
      .select({ createdAt: telemetryDeadLetter.createdAt })
      .from(telemetryDeadLetter)
      .where(eq(telemetryDeadLetter.queueName, this.queueName))
      .orderBy(telemetryDeadLetter.createdAt)
      .limit(1);

    const totalEntries = Number(countResult[0]?.count ?? 0);
    const oldestEntry = oldestResult[0]?.createdAt;
    const oldestAge = oldestEntry ? Date.now() - oldestEntry.getTime() : null;

    dlqEntriesGauge.set({ queue: this.queueName }, totalEntries);

    return {
      totalEntries,
      totalAdded: this.totalAdded,
      totalReplayed: this.totalReplayed,
      totalFailed: this.totalFailed,
      oldestEntryAge: oldestAge,
    };
  }

  prune(): number {
    return 0;
  }

  async pruneAsync(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    const countBefore = await db
      .select({ count: sql<number>`count(*)` })
      .from(telemetryDeadLetter)
      .where(
        and(
          eq(telemetryDeadLetter.queueName, this.queueName),
          sql`${telemetryDeadLetter.createdAt} < ${cutoff}`
        )
      );

    await db
      .delete(telemetryDeadLetter)
      .where(
        and(
          eq(telemetryDeadLetter.queueName, this.queueName),
          sql`${telemetryDeadLetter.createdAt} < ${cutoff}`
        )
      );

    const removed = Number(countBefore[0]?.count ?? 0);
    logger.info('PostgresDLQ', 'Pruned old entries', { queueName: this.queueName, removed });
    return removed;
  }

  clear(): number {
    return 0;
  }

  async clearAsync(): Promise<number> {
    const countBefore = await db
      .select({ count: sql<number>`count(*)` })
      .from(telemetryDeadLetter)
      .where(eq(telemetryDeadLetter.queueName, this.queueName));

    await db.delete(telemetryDeadLetter).where(eq(telemetryDeadLetter.queueName, this.queueName));

    const removed = Number(countBefore[0]?.count ?? 0);
    logger.info('PostgresDLQ', 'Cleared all entries', { queueName: this.queueName, removed });
    return removed;
  }

  async deleteAsync(id: string): Promise<boolean> {
    const entry = await this.getAsync(id);
    if (!entry) return false;

    await db.delete(telemetryDeadLetter).where(eq(telemetryDeadLetter.id, id));
    logger.info('PostgresDLQ', 'Deleted entry', { entryId: id });
    return true;
  }

  private rowToEntry(row: TelemetryDeadLetter): DeadLetterEntry<T> {
    return {
      id: row.id,
      payload: row.payload as T,
      error: row.error,
      source: row.source,
      retryCount: row.retryCount,
      createdAt: row.createdAt,
      metadata: row.metadata as Record<string, unknown> | undefined,
    };
  }
}

export function createPostgresDLQ<T = unknown>(config: PostgresDLQConfig): PostgresDeadLetterQueue<T> {
  return new PostgresDeadLetterQueue<T>(config);
}
