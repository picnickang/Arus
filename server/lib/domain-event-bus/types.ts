import { v4 as uuidv4 } from "uuid";
import type { DomainEventMap, DomainEventName } from "./types/event-map";

export * from "./types/envelope";
export * from "./types/payloads";
export * from "./types/event-map";

export function createDomainEvent<K extends DomainEventName>(
  eventType: K,
  orgId: string,
  payload: DomainEventMap[K]["payload"],
  options?: {
    correlationId?: string | undefined;
    causationId?: string | undefined;
    userId?: string | undefined;
    aggregateId?: string | undefined;
    aggregateType?: string | undefined;
  }
): DomainEventMap[K] {
  return {
    eventId: uuidv4(),
    eventType,
    occurredAt: new Date(),
    orgId,
    payload,
    ...options,
  } as DomainEventMap[K];
}
