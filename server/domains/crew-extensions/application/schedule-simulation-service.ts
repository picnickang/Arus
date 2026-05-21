/**
 * Schedule Simulation Service
 * Orchestrates SIMULATE mode for in-memory schedule planning
 * No database mutations until commit
 */

import { v4 as uuidv4 } from "uuid";
import type {
  ISimulationPreviewStore,
  IScheduleGeneratorStrategy,
  IScheduleAssignmentRepository,
  ICrewExtensionsEventPublisher,
  ISchedulerRunRepository,
} from "../domain/ports.js";
import type {
  SimulateScheduleCommand,
  SimulationPreview,
  CommitSimulationCommand,
  CompliancePreviewResult,
} from "../domain/types.js";
import {
  createEventId,
  type SimulationPreviewCreatedEvent,
  type SimulationCommittedEvent,
  type SimulationDiscardedEvent,
} from "../domain/events.js";
import { createLogger } from "../../../lib/structured-logger.js";

const logger = createLogger("ScheduleSimulationService");

const DEFAULT_PREVIEW_TTL_MS = 30 * 60 * 1000;

export interface ScheduleSimulationServiceDeps {
  previewStore: ISimulationPreviewStore;
  generator: IScheduleGeneratorStrategy;
  assignmentRepository: IScheduleAssignmentRepository;
  runRepository: ISchedulerRunRepository;
  eventPublisher: ICrewExtensionsEventPublisher;
}

export class ScheduleSimulationService {
  constructor(private deps: ScheduleSimulationServiceDeps) {}

  async simulate(command: SimulateScheduleCommand, userId?: string): Promise<SimulationPreview> {
    const { orgId, from, days, vessels, crewIds, strategy = "balanced" } = command;

    const fromDate = new Date(from);
    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + days - 1);

    const existingAssignments = await this.deps.assignmentRepository.findByDateRange(
      orgId,
      fromDate,
      toDate
    );

    const { proposedAssignments, unfilledShifts } = await this.deps.generator.generate({
      orgId,
      fromDate,
      toDate,
      vesselIds: vessels,
      crewIds,
      existingAssignments,
    });

    const compliance = await this.calculateCompliance(orgId, proposedAssignments);

    const diff = this.calculateDiff(existingAssignments, proposedAssignments);

    const summary = {
      totalProposed: proposedAssignments.length,
      totalUnfilled: unfilledShifts.length,
      complianceRate:
        compliance.summary.violationCount === 0
          ? 100
          : Math.round((compliance.summary.compliantCrew / compliance.summary.totalCrew) * 100),
      crewUtilization: this.calculateUtilization(proposedAssignments, days),
      estimatedHoursChange: this.calculateHoursChange(proposedAssignments),
    };

    const now = new Date();
    const preview: SimulationPreview = {
      previewId: uuidv4(),
      orgId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + DEFAULT_PREVIEW_TTL_MS),
      command,
      proposedAssignments,
      unfilledShifts,
      compliance,
      diff,
      summary,
    };

    await this.deps.previewStore.save(preview);

    const event: SimulationPreviewCreatedEvent = {
      eventId: createEventId(),
      eventType: "SimulationPreviewCreated",
      aggregateId: preview.previewId,
      aggregateType: "SimulationPreview",
      occurredAt: now,
      userId,
      orgId,
      version: 1,
      payload: {
        previewId: preview.previewId,
        proposedCount: proposedAssignments.length,
        unfilledCount: unfilledShifts.length,
        complianceRate: summary.complianceRate,
        strategy,
        dateRange: {
          from: fromDate.toISOString().split("T")[0],
          to: toDate.toISOString().split("T")[0],
        },
      },
    };

    await this.deps.eventPublisher.publish(event);

    logger.info("[ScheduleSimulationService] Created simulation preview", {
      previewId: preview.previewId,
      orgId,
      proposedCount: proposedAssignments.length,
      unfilledCount: unfilledShifts.length,
      complianceRate: summary.complianceRate,
    });

    return preview;
  }

  async getPreview(previewId: string, orgId: string): Promise<SimulationPreview | undefined> {
    return this.deps.previewStore.get(previewId, orgId);
  }

  async getLatestPreview(orgId: string): Promise<SimulationPreview | undefined> {
    return this.deps.previewStore.getLatest(orgId);
  }

  async commit(
    command: CommitSimulationCommand,
    userId?: string
  ): Promise<{ runId: string; assignmentsCreated: number }> {
    const preview = await this.deps.previewStore.get(command.previewId, command.orgId);
    if (!preview) {
      throw new Error(`Simulation preview ${command.previewId} not found or expired`);
    }

    let assignmentsToCommit = preview.proposedAssignments.filter((a) => a.changeType === "add");

    const selectedIds = command.selectedAssignmentIds;
    if (selectedIds && selectedIds.length > 0) {
      assignmentsToCommit = assignmentsToCommit.filter((a) => selectedIds.includes(a.tempId));
    }

    const run = await this.deps.runRepository.create({
      orgId: command.orgId,
      status: "pending",
      startDate: new Date(preview.command.from),
      endDate: new Date(preview.proposedAssignments[0]?.date || preview.command.from),
    });

    const assignmentRecords = assignmentsToCommit.map((a) => ({
      runId: run.id,
      crewId: a.crewId,
      vesselId: a.vesselId,
      date: new Date(a.date),
      shift: a.shift,
      role: a.role,
      status: "proposed" as const,
    }));

    if (assignmentRecords.length > 0) {
      await this.deps.assignmentRepository.createBulk(assignmentRecords);
    }

    await this.deps.previewStore.delete(command.previewId, command.orgId);

    const event: SimulationCommittedEvent = {
      eventId: createEventId(),
      eventType: "SimulationCommitted",
      aggregateId: command.previewId,
      aggregateType: "SimulationPreview",
      occurredAt: new Date(),
      userId,
      orgId: command.orgId,
      version: 1,
      payload: {
        previewId: command.previewId,
        runId: run.id,
        assignmentsCommitted: assignmentRecords.length,
        selectedOnly: !!command.selectedAssignmentIds,
      },
    };

    await this.deps.eventPublisher.publish(event);

    logger.info("[ScheduleSimulationService] Committed simulation", {
      previewId: command.previewId,
      runId: run.id,
      assignmentsCreated: assignmentRecords.length,
      orgId: command.orgId,
    });

    return {
      runId: run.id,
      assignmentsCreated: assignmentRecords.length,
    };
  }

  async discard(
    previewId: string,
    orgId: string,
    reason: "manual" | "expired" | "superseded" = "manual",
    userId?: string
  ): Promise<boolean> {
    const deleted = await this.deps.previewStore.delete(previewId, orgId);

    if (deleted) {
      const event: SimulationDiscardedEvent = {
        eventId: createEventId(),
        eventType: "SimulationDiscarded",
        aggregateId: previewId,
        aggregateType: "SimulationPreview",
        occurredAt: new Date(),
        userId,
        orgId,
        version: 1,
        payload: { previewId, reason },
      };

      await this.deps.eventPublisher.publish(event);

      logger.info("[ScheduleSimulationService] Discarded simulation", {
        previewId,
        orgId,
        reason,
      });
    }

    return deleted;
  }

  private async calculateCompliance(
    orgId: string,
    proposedAssignments: { crewId: string; date: string; shift: string }[]
  ): Promise<CompliancePreviewResult> {
    const crewIds = [...new Set(proposedAssignments.map((a) => a.crewId))];
    const violations: { type: "hard" | "soft"; code: string; message: string; crewId?: string }[] =
      [];

    const crewHours = new Map<string, number>();
    for (const a of proposedAssignments) {
      const hours = a.shift === "full_day" ? 12 : 8;
      crewHours.set(a.crewId, (crewHours.get(a.crewId) || 0) + hours);
    }

    for (const [crewId, hours] of crewHours) {
      if (hours > 72) {
        violations.push({
          type: "hard",
          code: "HOURS_EXCEEDED",
          message: `Crew member ${crewId} exceeds 72h weekly limit (${hours}h)`,
          crewId,
        });
      } else if (hours > 60) {
        violations.push({
          type: "soft",
          code: "HOURS_WARNING",
          message: `Crew member ${crewId} nearing limit (${hours}h)`,
          crewId,
        });
      }
    }

    const violatingCrew = new Set(violations.filter((v) => v.type === "hard").map((v) => v.crewId));
    const compliantCrew = crewIds.length - violatingCrew.size;

    return {
      isCompliant: violations.filter((v) => v.type === "hard").length === 0,
      violations,
      summary: {
        totalCrew: crewIds.length,
        compliantCrew,
        violationCount: violations.filter((v) => v.type === "hard").length,
        warningCount: violations.filter((v) => v.type === "soft").length,
      },
    };
  }

  private calculateDiff(
    existing: { id: string; crewId: string; date: Date; vesselId: string }[],
    proposed: { crewId: string; changeType: string }[]
  ) {
    const added = proposed.filter((p) => p.changeType === "add").length;
    const modified = proposed.filter((p) => p.changeType === "modify").length;
    const removed = proposed.filter((p) => p.changeType === "remove").length;
    const crewAffected = [...new Set(proposed.map((p) => p.crewId))];

    return {
      added,
      modified,
      removed,
      unchanged: existing.length - modified - removed,
      crewAffected,
    };
  }

  private calculateUtilization(assignments: { crewId: string }[], days: number): number {
    const uniqueCrew = new Set(assignments.map((a) => a.crewId)).size;
    if (uniqueCrew === 0) {
      return 0;
    }

    const avgAssignmentsPerCrew = assignments.length / uniqueCrew;
    const maxPossible = days * 2;
    return Math.round((avgAssignmentsPerCrew / maxPossible) * 100);
  }

  private calculateHoursChange(assignments: { shift: string }[]): number {
    return assignments.reduce((sum, a) => {
      switch (a.shift) {
        case "day":
          return sum + 8;
        case "night":
          return sum + 8;
        case "full_day":
          return sum + 12;
        default:
          return sum + 8;
      }
    }, 0);
  }
}
