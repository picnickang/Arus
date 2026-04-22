/**
 * Crew Extensions Domain Ports
 * Interfaces defining the contract between domain and infrastructure
 */

import type {
  SchedulerRunEntity,
  ScheduleAssignmentEntity,
  ScheduleUnfilledEntity,
  CreateSchedulerRunCommand,
} from "./types.js";
import type { CrewExtensionsDomainEvent } from "./events.js";
import type { SchedulePlannerView, SchedulePlannerFilter } from "./read-models.js";

export interface ISchedulerRunRepository {
  create(command: CreateSchedulerRunCommand): Promise<SchedulerRunEntity>;
  findById(id: string, orgId?: string): Promise<SchedulerRunEntity | undefined>;
  findByOrgId(orgId: string, limit?: number): Promise<SchedulerRunEntity[]>;
  findByStatus(orgId: string, status: string, limit?: number): Promise<SchedulerRunEntity[]>;
  findRecentByHash(
    orgId: string,
    inputHash: string,
    hoursBack?: number
  ): Promise<SchedulerRunEntity | undefined>;
  update(id: string, updates: Partial<SchedulerRunEntity>): Promise<SchedulerRunEntity>;
  approve(id: string, userId?: string): Promise<SchedulerRunEntity>;
  publish(id: string, userId: string): Promise<SchedulerRunEntity>;
  cancel(id: string, userId?: string): Promise<SchedulerRunEntity>;
  markHoRGenerated(id: string): Promise<SchedulerRunEntity>;
}

export interface IScheduleAssignmentRepository {
  createBulk(assignments: Omit<ScheduleAssignmentEntity, "id" | "createdAt">[]): Promise<void>;
  findByRunId(runId: string): Promise<ScheduleAssignmentEntity[]>;
  findByDateRange(orgId: string, fromDate: Date, toDate: Date): Promise<ScheduleAssignmentEntity[]>;
  deleteByDateRange(orgId: string, start: Date, end: Date, mode?: string): Promise<void>;
}

export interface IScheduleUnfilledRepository {
  createBulk(unfilled: Omit<ScheduleUnfilledEntity, "id" | "createdAt">[]): Promise<void>;
  findByOrgId(orgId: string, runId?: string): Promise<ScheduleUnfilledEntity[]>;
}

export interface ICrewExtensionsEventPublisher {
  publish(event: CrewExtensionsDomainEvent): Promise<void>;
  publishBatch(events: CrewExtensionsDomainEvent[]): Promise<void>;
}

export interface ICrewExtensionsAuditPort {
  recordAction(
    action: string,
    entityType: string,
    entityId: string,
    orgId: string,
    userId?: string,
    details?: Record<string, unknown>
  ): Promise<void>;
}

/**
 * Port for CQRS read model queries (Schedule Planner Board)
 */
export interface ISchedulePlannerReadModel {
  getView(filter: SchedulePlannerFilter): Promise<SchedulePlannerView>;
  refresh(orgId: string, triggeredBy: string): Promise<void>;
}

/**
 * Port for in-memory simulation preview storage
 */
export interface ISimulationPreviewStore {
  save(preview: import("./types.js").SimulationPreview): Promise<void>;
  get(
    previewId: string,
    orgId: string
  ): Promise<import("./types.js").SimulationPreview | undefined>;
  getLatest(orgId: string): Promise<import("./types.js").SimulationPreview | undefined>;
  delete(previewId: string, orgId: string): Promise<boolean>;
  deleteExpired(): Promise<number>;
}

/**
 * Port for schedule generation strategy
 */
export interface IScheduleGeneratorStrategy {
  generate(params: {
    orgId: string;
    fromDate: Date;
    toDate: Date;
    vesselIds?: string[];
    crewIds?: string[];
    existingAssignments: import("./types.js").ScheduleAssignmentEntity[];
  }): Promise<{
    proposedAssignments: import("./types.js").ProposedAssignment[];
    unfilledShifts: import("./types.js").SimulationUnfilledShift[];
  }>;
}

/**
 * Port for crew data access (read-only)
 */
export interface ICrewDataPort {
  findByOrgId(
    orgId: string,
    crewIds?: string[]
  ): Promise<
    Array<{
      id: string;
      name: string;
      role: string;
      status: string;
      certifications?: string[];
    }>
  >;
}

/**
 * Port for vessel data access (read-only)
 */
export interface IVesselDataPort {
  findByOrgId(
    orgId: string,
    vesselIds?: string[]
  ): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      status: string;
    }>
  >;
}
