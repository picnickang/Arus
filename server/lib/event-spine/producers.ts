import { createLogger } from "../structured-logger.js";
import type { EventSpineFanout, EventSpineMessage, EventSpineProducer } from "./types.js";

const logger = createLogger("EventSpine:Producer");

/**
 * NoopProducer — default. Logs at debug, succeeds always. Used when no
 * external streaming substrate is configured (dev, tests, single-node
 * deployments). The outbox worker still flushes pending rows through it,
 * which proves the outbox→worker→producer wiring without external infra.
 */
export class NoopProducer implements EventSpineProducer {
  async publish(message: EventSpineMessage): Promise<void> {
    logger.debug?.("[NoopProducer] publish", {
      eventId: message.eventId,
      eventType: message.eventType,
      orgId: message.orgId,
    });
  }

  async publishBatch(messages: EventSpineMessage[]): Promise<void> {
    for (const m of messages) {await this.publish(m);}
  }

  async close(): Promise<void> {}
}

/**
 * InMemoryFanoutProducer — production-shaped local fanout. Used by the
 * analytics sink consumer and by tests. Subscribers receive every
 * published message in-order per `orgId` partition (synchronous fan-out
 * preserves per-tenant ordering, matching the Kafka contract).
 */
export class InMemoryFanoutProducer implements EventSpineFanout {
  private handlers: Array<(m: EventSpineMessage) => Promise<void> | void> = [];

  onMessage(handler: (m: EventSpineMessage) => Promise<void> | void): void {
    this.handlers.push(handler);
  }

  async publish(message: EventSpineMessage): Promise<void> {
    for (const h of this.handlers) {
      try {
        await h(message);
      } catch (err) {
        logger.warn("In-memory subscriber threw — message still considered published", {
          eventId: message.eventId,
          eventType: message.eventType,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  async publishBatch(messages: EventSpineMessage[]): Promise<void> {
    for (const m of messages) {await this.publish(m);}
  }

  async close(): Promise<void> {
    this.handlers = [];
  }
}
