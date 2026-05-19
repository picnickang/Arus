import { createLogger } from "../structured-logger.js";
import {
  claimPendingBatch,
  markFailed,
  markPublished,
  reapStaleDispatching,
  type OutboxRow,
} from "./outbox-repository.js";
import type { EventSpineProducer, EventSpineMessage } from "./types.js";

const logger = createLogger("EventSpine:Worker");

export interface EventSpineWorkerOptions {
  producer: EventSpineProducer;
  batchSize?: number;
  /** Poll interval when queue was non-empty (ms). */
  busyPollMs?: number;
  /** Poll interval when queue was empty (ms). */
  idlePollMs?: number;
  /** Stale 'dispatching' reaper threshold (ms). */
  reapStaleMs?: number;
  /** Reaper sweep interval (ms). */
  reapEveryMs?: number;
}

/**
 * Polls `event_outbox` and dispatches pending rows through the configured
 * producer. Per-tenant ordering is preserved by Redpanda's partition-key
 * (orgId); within this worker we publish each row sequentially to avoid
 * out-of-order delivery into the producer client buffer.
 */
export class EventSpineWorker {
  private timer: NodeJS.Timeout | null = null;
  private reaperTimer: NodeJS.Timeout | null = null;
  private running = false;
  private stopping = false;

  constructor(private readonly opts: EventSpineWorkerOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stopping = false;
    this.scheduleNext(0);
    const reapEvery = this.opts.reapEveryMs ?? 60_000;
    this.reaperTimer = setInterval(() => {
      this.runReaper().catch((err) => {
        logger.warn("Reaper sweep failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, reapEvery);
    if (typeof this.reaperTimer.unref === "function") this.reaperTimer.unref();
    logger.info("Event-spine worker started", {
      batchSize: this.opts.batchSize ?? 32,
      busyPollMs: this.opts.busyPollMs ?? 50,
      idlePollMs: this.opts.idlePollMs ?? 500,
    });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.reaperTimer) {
      clearInterval(this.reaperTimer);
      this.reaperTimer = null;
    }
    this.running = false;
    await this.opts.producer.close().catch(() => {});
  }

  private scheduleNext(delay: number): void {
    if (this.stopping) return;
    this.timer = setTimeout(() => {
      this.tick().catch((err) => {
        logger.warn("Worker tick threw", {
          error: err instanceof Error ? err.message : String(err),
        });
        this.scheduleNext(this.opts.idlePollMs ?? 500);
      });
    }, delay);
    if (this.timer && typeof this.timer.unref === "function") this.timer.unref();
  }

  async tick(): Promise<number> {
    const batchSize = this.opts.batchSize ?? 32;
    let rows: OutboxRow[];
    try {
      rows = await claimPendingBatch(batchSize);
    } catch (err) {
      logger.warn("Failed to claim outbox batch", {
        error: err instanceof Error ? err.message : String(err),
      });
      this.scheduleNext(this.opts.idlePollMs ?? 500);
      return 0;
    }
    if (rows.length === 0) {
      this.scheduleNext(this.opts.idlePollMs ?? 500);
      return 0;
    }

    for (const row of rows) {
      const msg: EventSpineMessage = {
        eventId: row.eventId,
        eventType: row.eventType,
        orgId: row.orgId,
        aggregateId: row.aggregateId ?? undefined,
        aggregateType: row.aggregateType ?? undefined,
        occurredAt: row.occurredAt instanceof Date ? row.occurredAt : new Date(row.occurredAt),
        payload: row.payload,
      };
      try {
        await this.opts.producer.publish(msg);
        await markPublished(row.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markFailed(row.id, row.attempts, message).catch(() => {});
        logger.warn("Outbox dispatch failed", {
          eventId: row.eventId,
          eventType: row.eventType,
          attempts: row.attempts,
          error: message,
        });
      }
    }

    this.scheduleNext(this.opts.busyPollMs ?? 50);
    return rows.length;
  }

  async runReaper(): Promise<void> {
    const stale = this.opts.reapStaleMs ?? 60_000;
    const reset = await reapStaleDispatching(stale);
    if (reset > 0) {
      logger.info("Reaper reset stale dispatching rows", { reset });
    }
  }
}
