import { createLogger } from "../structured-logger.js";
import type { EventSpineMessage, EventSpineProducer } from "./types.js";

const logger = createLogger("EventSpine:Kafka");

export type KafkaSaslConfig =
  | { mechanism: "plain"; username: string; password: string }
  | { mechanism: "scram-sha-256"; username: string; password: string }
  | { mechanism: "scram-sha-512"; username: string; password: string };

export interface KafkaProducerOptions {
  /** Comma-separated `host:port` list (matches `EVENT_SPINE_BROKERS`). */
  brokers: string;
  /** Kafka topic prefix; final topic is `${topicPrefix}${eventType}`. */
  topicPrefix?: string | undefined;
  /** Kafka client id (defaults to `arus-event-spine`). */
  clientId?: string | undefined;
  /** SASL config (optional). */
  sasl?: KafkaSaslConfig | undefined;
  /** Enable SSL (auto-on when sasl provided). */
  ssl?: boolean | undefined;
  /** Connection timeout (ms). */
  connectionTimeout?: number | undefined;
}

/**
 * Real Kafka/Redpanda producer. Activated when `EVENT_SPINE_BROKERS` is
 * set in the environment. Uses kafkajs under the hood.
 *
 * Partition contract: every message is keyed with `message.orgId` so all
 * events for the same tenant land in the same partition, preserving the
 * per-tenant ordering invariant maintained by the outbox claim logic.
 *
 * Topic convention: `${topicPrefix}${eventType}` (e.g. `arus.work_order.created`).
 * Topic-per-event-type lets downstream consumers subscribe at the granularity
 * they need without overfetching.
 *
 * The kafkajs module is loaded lazily so that processes without
 * `EVENT_SPINE_BROKERS` never pull the kafka client into memory and dev
 * environments without a broker stay healthy.
 */
export class KafkaEventSpineProducer implements EventSpineProducer {
  private readonly opts: Required<Pick<KafkaProducerOptions, "topicPrefix" | "clientId">> &
    KafkaProducerOptions;
  private producer: unknown = null;
  private connected = false;
  private connecting: Promise<void> | null = null;

  constructor(opts: KafkaProducerOptions) {
    this.opts = {
      topicPrefix: "arus.",
      clientId: "arus-event-spine",
      ...opts,
    };
  }

  private async connect(): Promise<void> {
    if (this.connected) {return;}
    if (this.connecting) {return this.connecting;}
    this.connecting = (async () => {
      const kafkajs = (await import("kafkajs")) as typeof import("kafkajs");
      const kafka = new kafkajs.Kafka({
        ...(this.opts.clientId !== undefined ? { clientId: this.opts.clientId } : {}),
        brokers: this.opts.brokers.split(",").map((s) => s.trim()).filter(Boolean),
        ssl: this.opts.ssl ?? !!this.opts.sasl,
        ...(this.opts.sasl !== undefined ? { sasl: this.opts.sasl } : {}),
        connectionTimeout: this.opts.connectionTimeout ?? 10_000,
      });
      const producer = kafka.producer({
        allowAutoTopicCreation: true,
        idempotent: true,
        maxInFlightRequests: 1, // strict ordering per partition
      });
      await producer.connect();
      this.producer = producer;
      this.connected = true;
      logger.info("Kafka producer connected", {
        brokers: this.opts.brokers,
        topicPrefix: this.opts.topicPrefix,
      });
    })().catch((err) => {
      this.connecting = null;
      logger.error("Kafka producer connect failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    });
    return this.connecting;
  }

  private topicFor(eventType: string): string {
    return `${this.opts.topicPrefix}${eventType}`;
  }

  async publish(message: EventSpineMessage): Promise<void> {
    await this.publishBatch([message]);
  }

  async publishBatch(messages: EventSpineMessage[]): Promise<void> {
    if (messages.length === 0) {return;}
    await this.connect();
    const producer = this.producer as {
      sendBatch: (args: {
        topicMessages: Array<{
          topic: string;
          messages: Array<{ key: string; value: string; headers?: Record<string, string> }>;
        }>;
      }) => Promise<unknown>;
    };
    // Group by topic so we can use sendBatch (one network round-trip).
    const byTopic = new Map<string, Array<{ key: string; value: string; headers: Record<string, string> }>>();
    for (const m of messages) {
      const topic = this.topicFor(m.eventType);
      const list = byTopic.get(topic) ?? [];
      list.push({
        key: m.orgId, // partition key = orgId (Push B3 invariant)
        value: JSON.stringify(m.payload),
        headers: {
          eventId: m.eventId,
          eventType: m.eventType,
          orgId: m.orgId,
          ...(m.aggregateId ? { aggregateId: m.aggregateId } : {}),
          ...(m.aggregateType ? { aggregateType: m.aggregateType } : {}),
          occurredAt: m.occurredAt.toISOString(),
        },
      });
      byTopic.set(topic, list);
    }
    await producer.sendBatch({
      topicMessages: Array.from(byTopic.entries()).map(([topic, messages]) => ({ topic, messages })),
    });
  }

  async close(): Promise<void> {
    if (!this.connected || !this.producer) {return;}
    try {
      await (this.producer as { disconnect: () => Promise<void> }).disconnect();
    } catch (err) {
      logger.warn("Kafka producer disconnect failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.connected = false;
      this.producer = null;
    }
  }
}
