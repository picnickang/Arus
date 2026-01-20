/**
 * Domain Event Types Registry
 * Central registry for all domain events across bounded contexts
 * Provides typed discriminated unions for event-driven architecture
 */

import { v4 as uuidv4 } from 'uuid';

export type DomainEventCategory = 
  | 'maintenance'
  | 'crew'
  | 'inventory'
  | 'telemetry'
  | 'work-order'
  | 'compliance'
  | 'alerts';

export interface BaseDomainEvent<T extends string = string> {
  eventId: string;
  eventType: T;
  aggregateId: string;
  aggregateType: string;
  occurredAt: Date;
  userId?: string;
  orgId: string;
  version: number;
  correlationId?: string;
  causationId?: string;
}

export interface WorkOrderCreatedEvent extends BaseDomainEvent<'WorkOrderCreated'> {
  payload: {
    equipmentId: string;
    workOrderNumber: string;
    title: string;
    priority: string;
    status: string;
  };
}

export interface WorkOrderCompletedEvent extends BaseDomainEvent<'WorkOrderCompleted'> {
  payload: {
    completedAt: Date;
    completedBy: string;
    laborHours: number;
    partsUsed: Array<{ partId: string; quantity: number }>;
  };
}

export interface TelemetryAnomalyDetectedEvent extends BaseDomainEvent<'TelemetryAnomalyDetected'> {
  payload: {
    equipmentId: string;
    sensorId: string;
    anomalyType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    value: number;
    threshold: number;
    detectedAt: Date;
  };
}

export interface TelemetryBatchIngestedEvent extends BaseDomainEvent<'TelemetryBatchIngested'> {
  payload: {
    equipmentId: string;
    readingCount: number;
    startTime: Date;
    endTime: Date;
    source: string;
  };
}

export interface MaintenanceScheduledEvent extends BaseDomainEvent<'MaintenanceScheduled'> {
  payload: {
    equipmentId: string;
    scheduledDate: Date;
    maintenanceType: string;
    priority: string;
    estimatedDuration: number;
    triggeredBy: 'manual' | 'pdm' | 'interval' | 'condition';
  };
}

export interface MaintenanceCompletedEvent extends BaseDomainEvent<'MaintenanceCompleted'> {
  payload: {
    equipmentId: string;
    completedAt: Date;
    actualDuration: number;
    findings: string[];
    nextScheduledDate?: Date;
  };
}

export interface PredictiveMaintenanceAlertEvent extends BaseDomainEvent<'PredictiveMaintenanceAlert'> {
  payload: {
    equipmentId: string;
    predictionType: 'failure' | 'degradation' | 'anomaly';
    confidence: number;
    estimatedTimeToFailure: number;
    recommendedAction: string;
    modelVersion: string;
  };
}

export interface CrewAssignmentCreatedEvent extends BaseDomainEvent<'CrewAssignmentCreated'> {
  payload: {
    crewId: string;
    vesselId: string;
    shift: string;
    date: Date;
    role: string;
  };
}

export interface CrewCertificationExpiringEvent extends BaseDomainEvent<'CrewCertificationExpiring'> {
  payload: {
    crewId: string;
    certificationId: string;
    certificationType: string;
    expiresAt: Date;
    daysUntilExpiry: number;
  };
}

export interface InventoryLowStockEvent extends BaseDomainEvent<'InventoryLowStock'> {
  payload: {
    partId: string;
    partNo: string;
    currentQuantity: number;
    minQuantity: number;
    vesselId?: string;
    reorderSuggested: boolean;
  };
}

export interface InventoryMovementEvent extends BaseDomainEvent<'InventoryMovement'> {
  payload: {
    partId: string;
    movementType: 'in' | 'out' | 'transfer' | 'adjustment';
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    referenceType?: string;
    referenceId?: string;
  };
}

export interface ComplianceViolationDetectedEvent extends BaseDomainEvent<'ComplianceViolationDetected'> {
  payload: {
    ruleId: string;
    ruleName: string;
    severity: 'minor' | 'major' | 'critical';
    entityType: string;
    entityId: string;
    details: string;
  };
}

export interface AlertTriggeredEvent extends BaseDomainEvent<'AlertTriggered'> {
  payload: {
    alertType: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    source: string;
    message: string;
    metadata: Record<string, unknown>;
  };
}

export type DomainEvent =
  | WorkOrderCreatedEvent
  | WorkOrderCompletedEvent
  | TelemetryAnomalyDetectedEvent
  | TelemetryBatchIngestedEvent
  | MaintenanceScheduledEvent
  | MaintenanceCompletedEvent
  | PredictiveMaintenanceAlertEvent
  | CrewAssignmentCreatedEvent
  | CrewCertificationExpiringEvent
  | InventoryLowStockEvent
  | InventoryMovementEvent
  | ComplianceViolationDetectedEvent
  | AlertTriggeredEvent;

export type DomainEventType = DomainEvent['eventType'];

export function createEventId(): string {
  return uuidv4();
}

export function createCorrelationId(): string {
  return `corr_${uuidv4()}`;
}

export function createBaseEvent<T extends DomainEventType>(
  eventType: T,
  aggregateId: string,
  aggregateType: string,
  orgId: string,
  userId?: string,
  correlationId?: string
): Omit<BaseDomainEvent<T>, 'payload'> & { eventType: T } {
  return {
    eventId: createEventId(),
    eventType,
    aggregateId,
    aggregateType,
    occurredAt: new Date(),
    userId,
    orgId,
    version: 1,
    correlationId,
  };
}
