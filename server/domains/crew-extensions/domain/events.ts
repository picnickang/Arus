/**
 * Crew Extensions Domain Events
 * Typed discriminated unions for event-driven architecture
 */

import { v4 as uuidv4 } from "uuid";

export type CrewExtensionsEventType =
  | "SchedulerRunCreated"
  | "SchedulerRunApproved"
  | "SchedulerRunApplied"
  | "SchedulerRunCancelled"
  | "ScheduleAssignmentsCreated"
  | "HoRGeneratedFromSchedule"
  | "SimulationPreviewCreated"
  | "SimulationCommitted"
  | "SimulationDiscarded";

interface BaseCrewExtensionsEvent {
  eventId: string;
  aggregateId: string;
  aggregateType: "SchedulerRun" | "ScheduleAssignment" | "SimulationPreview";
  occurredAt: Date;
  userId?: string;
  orgId: string;
  version: number;
}

export interface SchedulerRunCreatedEvent extends BaseCrewExtensionsEvent {
  eventType: "SchedulerRunCreated";
  payload: {
    status: string;
    startDate: Date | null;
    endDate: Date | null;
    mode: string;
  };
}

export interface SchedulerRunApprovedEvent extends BaseCrewExtensionsEvent {
  eventType: "SchedulerRunApproved";
  payload: {
    previousStatus: string;
    approvedBy: string | null;
  };
}

export interface SchedulerRunAppliedEvent extends BaseCrewExtensionsEvent {
  eventType: "SchedulerRunApplied";
  payload: {
    assignmentCount: number;
    unfilledCount: number;
  };
}

export interface SchedulerRunCancelledEvent extends BaseCrewExtensionsEvent {
  eventType: "SchedulerRunCancelled";
  payload: {
    previousStatus: string;
    reason?: string;
  };
}

export interface ScheduleAssignmentsCreatedEvent extends BaseCrewExtensionsEvent {
  eventType: "ScheduleAssignmentsCreated";
  payload: {
    runId: string;
    assignmentCount: number;
    unfilledCount: number;
  };
}

export interface HoRGeneratedFromScheduleEvent extends BaseCrewExtensionsEvent {
  eventType: "HoRGeneratedFromSchedule";
  payload: {
    runId: string;
    sheetsCreated: number;
    daysCreated: number;
  };
}

export interface SimulationPreviewCreatedEvent extends BaseCrewExtensionsEvent {
  eventType: "SimulationPreviewCreated";
  aggregateType: "SimulationPreview";
  payload: {
    previewId: string;
    proposedCount: number;
    unfilledCount: number;
    complianceRate: number;
    strategy: string;
    dateRange: { from: string; to: string };
  };
}

export interface SimulationCommittedEvent extends BaseCrewExtensionsEvent {
  eventType: "SimulationCommitted";
  aggregateType: "SimulationPreview";
  payload: {
    previewId: string;
    runId: string;
    assignmentsCommitted: number;
    selectedOnly: boolean;
  };
}

export interface SimulationDiscardedEvent extends BaseCrewExtensionsEvent {
  eventType: "SimulationDiscarded";
  aggregateType: "SimulationPreview";
  payload: {
    previewId: string;
    reason: "manual" | "expired" | "superseded";
  };
}

export type CrewExtensionsDomainEvent =
  | SchedulerRunCreatedEvent
  | SchedulerRunApprovedEvent
  | SchedulerRunAppliedEvent
  | SchedulerRunCancelledEvent
  | ScheduleAssignmentsCreatedEvent
  | HoRGeneratedFromScheduleEvent
  | SimulationPreviewCreatedEvent
  | SimulationCommittedEvent
  | SimulationDiscardedEvent;

export function createEventId(): string {
  return uuidv4();
}
