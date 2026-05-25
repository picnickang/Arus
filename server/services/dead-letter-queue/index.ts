import { EventEmitter } from "node:events";
import client from "prom-client";
import * as repository from "./repository";
import type {
  DeadLetterEntry,
  DeadLetterQueueConfig,
  DeadLetterQueueMetrics,
  ReplayResult,
} from "./types";
import { logger } from "../../utils/logger";

const dlqEntriesGauge = new client.Gauge({
  name: "arus_dlq_entries_total",
  help: "Total entries in dead letter queue",
  labelNames: ["queue"],
});

const dlqAddedTotal = new client.Counter({
  name: "arus_dlq_added_total",
  help: "Total entries added to dead letter queue",
  labelNames: ["queue", "source"],
});

const dlqReplayedTotal = new client.Counter({
  name: "arus_dlq_replayed_total",
  help: "Total entries replayed from dead letter queue",
  labelNames: ["queue", "status"],
});

const DEFAULT_CONFIG: DeadLetterQueueConfig = {
  maxEntries: 10000,
  retentionDays: 7,
  name: "default",
};

export class DeadLetterQueue<T = unknown> extends EventEmitter {
  private readonly config: DeadLetterQueueConfig;
  private replayHandler: ((entry: DeadLetterEntry<T>) => Promise<void>) | null = null;

  constructor(config: Partial<DeadLetterQueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setReplayHandler(handler: (entry: DeadLetterEntry<T>) => Promise<void>): void {
    this.replayHandler = handler;
  }

  add(
    payload: T,
    error: string,
    source: string,
    metadata?: Record<string, unknown>
  ): DeadLetterEntry<T> {
    const queue = repository.getQueue(this.config.name);

    if (queue.length >= this.config.maxEntries) {
      const removed = repository.clearOldEntries(this.config.name, 1);
      if (removed === 0) {
        repository.removeEntry(this.config.name, queue[0]!.id);
      }
    }

    const entry = repository.addEntry(this.config.name, payload, error, source, metadata);

    dlqAddedTotal.inc({ queue: this.config.name, source });
    dlqEntriesGauge.set({ queue: this.config.name }, repository.getQueue(this.config.name).length);

    logger.warn("DeadLetterQueue", `Added entry from ${source}`, { entryId: entry.id, error });
    this.emit("added", entry);

    return entry as DeadLetterEntry<T>;
  }

  get(id: string): DeadLetterEntry<T> | undefined {
    return repository.getEntry(this.config.name, id) as DeadLetterEntry<T> | undefined;
  }

  list(options: { limit?: number | undefined; offset?: number | undefined; source?: string | undefined } = {}): DeadLetterEntry<T>[] {
    return repository.listEntries(this.config.name, options) as DeadLetterEntry<T>[];
  }

  async replay(id: string): Promise<ReplayResult> {
    const entry = this.get(id);
    if (!entry) {
      return { success: false, entryId: id, error: "Entry not found" };
    }

    if (!this.replayHandler) {
      return { success: false, entryId: id, error: "No replay handler configured" };
    }

    try {
      await this.replayHandler(entry);
      repository.removeEntry(this.config.name, id);

      dlqReplayedTotal.inc({ queue: this.config.name, status: "success" });
      dlqEntriesGauge.set(
        { queue: this.config.name },
        repository.getQueue(this.config.name).length
      );

      logger.info("DeadLetterQueue", `Replayed entry successfully`, { entryId: id });
      this.emit("replayed", { entry, success: true });

      return { success: true, entryId: id };
    } catch (err) {
      repository.incrementRetry(this.config.name, id);

      dlqReplayedTotal.inc({ queue: this.config.name, status: "failure" });

      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("DeadLetterQueue", `Replay failed`, { entryId: id, error: errorMsg });
      this.emit("replayFailed", { entry, error: err });

      return { success: false, entryId: id, error: errorMsg };
    }
  }

  async replayAll(options: { source?: string | undefined; limit?: number | undefined } = {}): Promise<ReplayResult[]> {
    const entries = this.list({ source: options.source, limit: options.limit });
    const results: ReplayResult[] = [];

    for (const entry of entries) {
      results.push(await this.replay(entry.id));
    }

    return results;
  }

  getMetrics(): DeadLetterQueueMetrics {
    return repository.getMetrics(this.config.name);
  }

  prune(): number {
    const removed = repository.clearOldEntries(this.config.name, this.config.retentionDays);
    dlqEntriesGauge.set({ queue: this.config.name }, repository.getQueue(this.config.name).length);
    return removed;
  }

  clear(): number {
    const count = repository.clearQueue(this.config.name);
    dlqEntriesGauge.set({ queue: this.config.name }, 0);
    return count;
  }
}

export function createDeadLetterQueue<T = unknown>(
  config: Partial<DeadLetterQueueConfig> = {}
): DeadLetterQueue<T> {
  return new DeadLetterQueue<T>(config);
}

export * from "./types";
