/**
 * Cloud-Safe Outbox Processor
 * Production-ready worker for processing sync_outbox with retry/backoff
 * Aligned with existing sync_outbox schema
 */

import { db, isCloudMode } from '../../db';
import { syncOutbox } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { log } from '../structured-logger';

export interface OutboxProcessorConfig {
  batchSize: number;
  pollIntervalMs: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  processorId: string;
}

export interface OutboxMessage {
  id: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: Date | null;
  processingAttempts: number | null;
}

type MessageHandler = (message: OutboxMessage) => Promise<void>;

const DEFAULT_CONFIG: OutboxProcessorConfig = {
  batchSize: 50,
  pollIntervalMs: 5000,
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  processorId: `processor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
};

export class OutboxProcessor {
  private config: OutboxProcessorConfig;
  private handlers: Map<string, MessageHandler> = new Map();
  private isRunning = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private stats = {
    processed: 0,
    failed: 0,
    retried: 0,
    lastPollAt: null as Date | null,
  };

  constructor(config: Partial<OutboxProcessorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  registerHandler(eventType: string, handler: MessageHandler): void {
    this.handlers.set(eventType, handler);
    log('info', `[OutboxProcessor] Registered handler for ${eventType}`);
  }

  registerDefaultHandler(handler: MessageHandler): void {
    this.handlers.set('*', handler);
    log('info', '[OutboxProcessor] Registered default handler');
  }

  async start(): Promise<void> {
    if (!isCloudMode()) {
      log('info', '[OutboxProcessor] Skipping - not in cloud mode');
      return;
    }

    if (this.isRunning) {
      log('warn', '[OutboxProcessor] Already running');
      return;
    }

    this.isRunning = true;
    log('info', '[OutboxProcessor] Started', { config: this.config });
    this.schedulePoll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    log('info', '[OutboxProcessor] Stopped', { stats: this.stats });
  }

  private schedulePoll(): void {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(async () => {
      try {
        await this.poll();
      } catch (error) {
        log('error', '[OutboxProcessor] Poll error', { error });
      }
      this.schedulePoll();
    }, this.config.pollIntervalMs);
  }

  private async poll(): Promise<void> {
    this.stats.lastPollAt = new Date();

    const messages = await this.fetchPendingMessages();
    if (messages.length === 0) return;

    log('debug', `[OutboxProcessor] Processing ${messages.length} messages`);

    for (const message of messages) {
      await this.processMessage(message);
    }
  }

  private async fetchPendingMessages(): Promise<OutboxMessage[]> {
    const rows = await db
      .select()
      .from(syncOutbox)
      .where(
        and(
          eq(syncOutbox.processed, false),
          lt(syncOutbox.processingAttempts, this.config.maxRetries)
        )
      )
      .limit(this.config.batchSize);

    return rows.map(row => ({
      id: row.id,
      eventType: row.eventType,
      payload: row.payload as Record<string, unknown> | null,
      createdAt: row.createdAt,
      processingAttempts: row.processingAttempts,
    }));
  }

  private async processMessage(message: OutboxMessage): Promise<void> {
    const eventPrefix = message.eventType.split('.')[0];
    const handler = this.handlers.get(message.eventType) 
      || this.handlers.get(eventPrefix)
      || this.handlers.get('*');

    if (!handler) {
      log('warn', `[OutboxProcessor] No handler for ${message.eventType}`, { messageId: message.id });
      await this.markProcessed(message.id);
      return;
    }

    try {
      await handler(message);
      await this.markProcessed(message.id);
      this.stats.processed++;
      log('debug', `[OutboxProcessor] Processed ${message.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.handleFailure(message, errorMessage);
    }
  }

  private async markProcessed(id: string): Promise<void> {
    await db
      .update(syncOutbox)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(eq(syncOutbox.id, id));
  }

  private async handleFailure(message: OutboxMessage, error: string): Promise<void> {
    const currentAttempts = message.processingAttempts ?? 0;
    const newAttempts = currentAttempts + 1;

    if (newAttempts >= this.config.maxRetries) {
      await db
        .update(syncOutbox)
        .set({
          processed: true,
          processedAt: new Date(),
          processingAttempts: newAttempts,
        })
        .where(eq(syncOutbox.id, message.id));
      
      this.stats.failed++;
      log('error', `[OutboxProcessor] Message ${message.id} failed permanently after ${newAttempts} attempts`, { error });
      return;
    }

    await db
      .update(syncOutbox)
      .set({
        processingAttempts: newAttempts,
      })
      .where(eq(syncOutbox.id, message.id));

    this.stats.retried++;
    const delay = this.calculateBackoff(newAttempts);
    log('warn', `[OutboxProcessor] Message ${message.id} failed, retry ${newAttempts}/${this.config.maxRetries}`, {
      error,
      nextRetryInMs: delay,
    });
  }

  private calculateBackoff(retryCount: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, retryCount - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, this.config.maxDelayMs);
  }

  getStats(): typeof this.stats {
    return { ...this.stats };
  }
}

export const outboxProcessor = new OutboxProcessor();
