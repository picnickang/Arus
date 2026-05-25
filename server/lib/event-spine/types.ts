import type { DomainEventEnvelope } from "../domain-event-bus/types.js";

export interface EventSpineMessage {
  eventId: string;
  eventType: string;
  orgId: string;
  aggregateId?: string | undefined;
  aggregateType?: string | undefined;
  occurredAt: Date;
  payload: unknown;
}

export interface EventSpineProducer {
  publish(message: EventSpineMessage): Promise<void>;
  publishBatch(messages: EventSpineMessage[]): Promise<void>;
  close(): Promise<void>;
}

export interface EventSpineSubscriber {
  onMessage(handler: (message: EventSpineMessage) => Promise<void> | void): void;
}

export type EventSpineFanout = EventSpineProducer & EventSpineSubscriber;

export interface EnqueueOutboxInput {
  eventId: string;
  eventType: string;
  orgId: string;
  aggregateId?: string | null;
  aggregateType?: string | null;
  occurredAt?: Date;
  payload: unknown;
}

export function envelopeToOutboxInput(envelope: DomainEventEnvelope): EnqueueOutboxInput {
  return {
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    orgId: envelope.orgId,
    aggregateId: envelope.aggregateId ?? null,
    aggregateType: envelope.aggregateType ?? null,
    occurredAt: envelope.occurredAt,
    payload: envelope,
  };
}
