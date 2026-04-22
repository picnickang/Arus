/**
 * Crew Extensions Application Service
 * Orchestrates domain logic using injected ports
 */

import type {
  ISchedulerRunRepository,
  IScheduleAssignmentRepository,
  ICrewExtensionsEventPublisher,
  ISchedulePlannerReadModel,
} from '../domain/ports.js';
import type {
  SchedulerRunEntity,
  ScheduleAssignmentEntity,
  PlanScheduleCommand,
  ApplyScheduleCommand,
  CompliancePreviewResult,
} from '../domain/types.js';
import type { SchedulePlannerView, SchedulePlannerFilter } from '../domain/read-models.js';
import {
  createEventId,
  type SchedulerRunCreatedEvent,
  type SchedulerRunAppliedEvent,
  type SchedulerRunCancelledEvent,
  type HoRGeneratedFromScheduleEvent,
} from '../domain/events.js';

export interface CrewExtensionsServiceDeps {
  schedulerRunRepository: ISchedulerRunRepository;
  assignmentRepository: IScheduleAssignmentRepository;
  eventPublisher: ICrewExtensionsEventPublisher;
  schedulePlannerReadModel: ISchedulePlannerReadModel;
}

export class CrewExtensionsApplicationService {
  constructor(private deps: CrewExtensionsServiceDeps) {}

  async getSchedulerRuns(orgId: string, limit?: number): Promise<SchedulerRunEntity[]> {
    return this.deps.schedulerRunRepository.findByOrgId(orgId, limit);
  }

  async getSchedulerRun(id: string, orgId: string): Promise<SchedulerRunEntity | undefined> {
    return this.deps.schedulerRunRepository.findById(id, orgId);
  }

  async getSchedulerRunWithAssignments(
    id: string,
    orgId: string
  ): Promise<{ run: SchedulerRunEntity; assignments: ScheduleAssignmentEntity[] } | undefined> {
    const run = await this.deps.schedulerRunRepository.findById(id, orgId);
    if (!run) {return undefined;}

    const assignments = await this.deps.assignmentRepository.findByRunId(id);
    return { run, assignments };
  }

  async planSchedule(command: PlanScheduleCommand, userId?: string): Promise<SchedulerRunEntity> {
    const { planAndMaybeExecute } = await import('../../../scheduler/scheduler-controller.js');
    
    const result = await planAndMaybeExecute({
      orgId: command.orgId,
      from: command.from,
      days: command.days,
      vessels: command.vessels,
      mode: command.mode,
    });

    if (!result.runId) {
      throw new Error('Failed to create scheduler run');
    }

    const run = await this.deps.schedulerRunRepository.findById(result.runId, command.orgId);
    if (!run) {
      throw new Error(`Scheduler run ${result.runId} not found after creation`);
    }

    const event: SchedulerRunCreatedEvent = {
      eventId: createEventId(),
      eventType: 'SchedulerRunCreated',
      aggregateId: run.id,
      aggregateType: 'SchedulerRun',
      occurredAt: new Date(),
      userId,
      orgId: command.orgId,
      version: 1,
      payload: {
        status: run.status,
        startDate: run.startDate,
        endDate: run.endDate,
        mode: command.mode,
      },
    };

    await this.deps.eventPublisher.publish(event);

    return run;
  }

  async applySchedule(command: ApplyScheduleCommand): Promise<SchedulerRunEntity> {
    const run = await this.deps.schedulerRunRepository.findById(command.runId, command.orgId);
    if (!run) {
      throw new Error(`Scheduler run ${command.runId} not found in org ${command.orgId}`);
    }

    const { applySchedule } = await import('../../../scheduler/scheduler-controller.js');
    await applySchedule(command.runId, command.orgId);

    const updatedRun = await this.deps.schedulerRunRepository.findById(command.runId, command.orgId);
    if (!updatedRun) {
      throw new Error(`Scheduler run ${command.runId} not found after apply`);
    }

    const assignments = await this.deps.assignmentRepository.findByRunId(command.runId);

    const event: SchedulerRunAppliedEvent = {
      eventId: createEventId(),
      eventType: 'SchedulerRunApplied',
      aggregateId: command.runId,
      aggregateType: 'SchedulerRun',
      occurredAt: new Date(),
      userId: command.userId,
      orgId: command.orgId,
      version: 1,
      payload: {
        assignmentCount: assignments.length,
        unfilledCount: updatedRun.unfilledCount || 0,
      },
    };

    await this.deps.eventPublisher.publish(event);

    return updatedRun;
  }

  async cancelSchedule(runId: string, orgId: string, userId?: string): Promise<SchedulerRunEntity> {
    const run = await this.deps.schedulerRunRepository.findById(runId, orgId);
    if (!run) {
      throw new Error(`Scheduler run ${runId} not found in org ${orgId}`);
    }

    const previousStatus = run.status;
    const { cancelScheduleRun } = await import('../../../scheduler/scheduler-controller.js');
    await cancelScheduleRun(runId, orgId);

    const updatedRun = await this.deps.schedulerRunRepository.findById(runId, orgId);
    if (!updatedRun) {
      throw new Error(`Scheduler run ${runId} not found after cancellation`);
    }

    const event: SchedulerRunCancelledEvent = {
      eventId: createEventId(),
      eventType: 'SchedulerRunCancelled',
      aggregateId: runId,
      aggregateType: 'SchedulerRun',
      occurredAt: new Date(),
      userId,
      orgId,
      version: 1,
      payload: {
        previousStatus,
      },
    };

    await this.deps.eventPublisher.publish(event);

    return updatedRun;
  }

  async generateHoRFromSchedule(runId: string, orgId: string, userId?: string): Promise<{
    success: boolean;
    sheetsCreated: number;
    daysCreated: number;
    errors?: string[];
  }> {
    const run = await this.deps.schedulerRunRepository.findById(runId, orgId);
    if (!run) {
      throw new Error(`Scheduler run ${runId} not found in org ${orgId}`);
    }

    const { generateHoRFromSchedule } = await import('../../../scheduler/hor-generator.js');
    const result = await generateHoRFromSchedule(runId);

    if (result.success) {
      const event: HoRGeneratedFromScheduleEvent = {
        eventId: createEventId(),
        eventType: 'HoRGeneratedFromSchedule',
        aggregateId: runId,
        aggregateType: 'SchedulerRun',
        occurredAt: new Date(),
        userId,
        orgId,
        version: 1,
        payload: {
          runId,
          sheetsCreated: result.sheetsCreated || 0,
          daysCreated: result.daysCreated || 0,
        },
      };

      await this.deps.eventPublisher.publish(event);
    }

    return result;
  }

  async previewCompliance(
    orgId: string,
    runIdOrAssignments: string | any[]
  ): Promise<CompliancePreviewResult> {
    let assignments: any[] = [];

    if (typeof runIdOrAssignments === 'string') {
      const run = await this.deps.schedulerRunRepository.findById(runIdOrAssignments, orgId);
      if (!run) {
        throw new Error(`Scheduler run ${runIdOrAssignments} not found in org ${orgId}`);
      }
      assignments = await this.deps.assignmentRepository.findByRunId(runIdOrAssignments);
    } else {
      assignments = runIdOrAssignments;
    }

    if (assignments.length === 0) {
      return {
        isCompliant: true,
        violations: [],
        summary: { totalCrew: 0, compliantCrew: 0, violationCount: 0, warningCount: 0 },
      };
    }

    const { previewScheduleCompliance } = await import('../../../scheduler/compliance-preview.js');
    return previewScheduleCompliance(orgId, assignments);
  }

  async getAssignmentsByDateRange(
    orgId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<ScheduleAssignmentEntity[]> {
    return this.deps.assignmentRepository.findByDateRange(orgId, fromDate, toDate);
  }

  async getSchedulePlannerView(filter: SchedulePlannerFilter): Promise<SchedulePlannerView> {
    return this.deps.schedulePlannerReadModel.getView(filter);
  }

  async refreshSchedulePlannerView(orgId: string, triggeredBy: string): Promise<void> {
    return this.deps.schedulePlannerReadModel.refresh(orgId, triggeredBy);
  }
}
