/**
 * Scheduled Reports Domain - Events
 * Domain events for report lifecycle
 */

import type { ReportType, ReportFormat } from "./types.js";

export interface DomainEvent {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  orgId: string;
  payload: unknown;
}

export interface ReportScheduleCreatedEvent extends DomainEvent {
  eventType: "ReportScheduleCreated";
  payload: {
    scheduleId: string;
    reportType: ReportType;
    name: string;
    cronExpression: string;
    createdBy: string;
  };
}

export interface ReportScheduleUpdatedEvent extends DomainEvent {
  eventType: "ReportScheduleUpdated";
  payload: {
    scheduleId: string;
    changes: Record<string, unknown>;
    updatedBy: string;
  };
}

export interface ReportScheduleDeletedEvent extends DomainEvent {
  eventType: "ReportScheduleDeleted";
  payload: {
    scheduleId: string;
    deletedBy: string;
  };
}

export interface ReportGenerationStartedEvent extends DomainEvent {
  eventType: "ReportGenerationStarted";
  payload: {
    reportId: string;
    scheduleId: string;
    reportType: ReportType;
  };
}

export interface ReportGeneratedEvent extends DomainEvent {
  eventType: "ReportGenerated";
  payload: {
    reportId: string;
    scheduleId: string;
    reportType: ReportType;
    format: ReportFormat;
    filename: string;
    fileSize: number;
    generationTimeMs: number;
  };
}

export interface ReportGenerationFailedEvent extends DomainEvent {
  eventType: "ReportGenerationFailed";
  payload: {
    reportId: string;
    scheduleId: string;
    reportType: ReportType;
    errorMessage: string;
  };
}

export interface ReportDeliveredEvent extends DomainEvent {
  eventType: "ReportDelivered";
  payload: {
    reportId: string;
    scheduleId: string;
    recipients: string[];
    deliveryMethod: "email" | "download";
  };
}

export interface ReportDeliveryFailedEvent extends DomainEvent {
  eventType: "ReportDeliveryFailed";
  payload: {
    reportId: string;
    scheduleId: string;
    recipients: string[];
    errorMessage: string;
  };
}

export type ScheduledReportEvent =
  | ReportScheduleCreatedEvent
  | ReportScheduleUpdatedEvent
  | ReportScheduleDeletedEvent
  | ReportGenerationStartedEvent
  | ReportGeneratedEvent
  | ReportGenerationFailedEvent
  | ReportDeliveredEvent
  | ReportDeliveryFailedEvent;

export function createEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createEvent<T extends DomainEvent>(
  eventType: T["eventType"],
  orgId: string,
  payload: T["payload"]
): T {
  return {
    eventId: createEventId(),
    eventType,
    occurredAt: new Date(),
    orgId,
    payload,
  } as T;
}
