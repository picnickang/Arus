export interface DomainEventEnvelope<T extends string = string, P = unknown> {
  eventId: string;
  eventType: T;
  occurredAt: Date;
  orgId: string;
  correlationId?: string | undefined;
  causationId?: string | undefined;
  userId?: string | undefined;
  aggregateId?: string | undefined;
  aggregateType?: string | undefined;
  payload: P;
}
