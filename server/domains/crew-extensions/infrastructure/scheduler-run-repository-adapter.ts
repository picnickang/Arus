/**
 * Scheduler Run Repository Adapter
 * Implements ISchedulerRunRepository using existing storage
 */

import type { ISchedulerRunRepository } from '../domain/ports.js';
import type { SchedulerRunEntity, CreateSchedulerRunCommand } from '../domain/types.js';
import { dbSchedulerStorage } from '../../../repositories';

function mapToEntity(run: any): SchedulerRunEntity {
  return {
    id: run.id,
    orgId: run.orgId,
    status: run.status,
    startDate: run.startDate ? new Date(run.startDate) : null,
    endDate: run.endDate ? new Date(run.endDate) : null,
    totalAssignments: run.totalAssignments,
    unfilledCount: run.unfilledCount,
    inputHash: run.inputHash,
    generatedByRunId: run.generatedByRunId,
    horGenerated: run.horGenerated ?? false,
    createdAt: run.createdAt ? new Date(run.createdAt) : new Date(),
    completedAt: run.completedAt ? new Date(run.completedAt) : null,
    approvedAt: run.approvedAt ? new Date(run.approvedAt) : null,
    approvedBy: run.approvedBy,
    publishedAt: run.publishedAt ? new Date(run.publishedAt) : null,
    publishedBy: run.publishedBy,
  };
}

export class SchedulerRunRepositoryAdapter implements ISchedulerRunRepository {
  async create(command: CreateSchedulerRunCommand): Promise<SchedulerRunEntity> {
    const run = await dbSchedulerStorage.createSchedulerRun({
      orgId: command.orgId,
      status: command.status || 'pending',
      startDate: command.startDate,
      endDate: command.endDate,
      inputHash: command.inputHash,
    });
    return mapToEntity(run);
  }

  async findById(id: string, orgId?: string): Promise<SchedulerRunEntity | undefined> {
    const run = await dbSchedulerStorage.getSchedulerRun(id);
    if (!run) {return undefined;}
    if (orgId && run.orgId !== orgId) {return undefined;}
    return mapToEntity(run);
  }

  async findByOrgId(orgId: string, limit?: number): Promise<SchedulerRunEntity[]> {
    const runs = await dbSchedulerStorage.getSchedulerRuns(orgId, undefined, limit);
    return runs.map(mapToEntity);
  }

  async findByStatus(orgId: string, status: string, limit?: number): Promise<SchedulerRunEntity[]> {
    const runs = await dbSchedulerStorage.getSchedulerRunsByStatus(orgId, status, limit);
    return runs.map(mapToEntity);
  }

  async findRecentByHash(orgId: string, inputHash: string, hoursBack?: number): Promise<SchedulerRunEntity | undefined> {
    const run = await dbSchedulerStorage.findRecentSchedulerRunByHash(orgId, inputHash, hoursBack);
    return run ? mapToEntity(run) : undefined;
  }

  async update(id: string, updates: Partial<SchedulerRunEntity>): Promise<SchedulerRunEntity> {
    const run = await dbSchedulerStorage.updateSchedulerRun(id, updates as Partial<import("@shared/schema-runtime").InsertSchedulerRun>);
    return mapToEntity(run);
  }

  async approve(id: string, userId?: string): Promise<SchedulerRunEntity> {
    const run = await dbSchedulerStorage.approveSchedulerRun(id, userId);
    return mapToEntity(run);
  }

  async publish(id: string, userId: string): Promise<SchedulerRunEntity> {
    const run = await dbSchedulerStorage.publishSchedulerRun(id, userId);
    return mapToEntity(run);
  }

  async cancel(id: string, userId?: string): Promise<SchedulerRunEntity> {
    const run = await dbSchedulerStorage.cancelSchedulerRun(id, userId);
    return mapToEntity(run);
  }

  async markHoRGenerated(id: string): Promise<SchedulerRunEntity> {
    const run = await dbSchedulerStorage.markSchedulerRunHorGenerated(id);
    return mapToEntity(run);
  }
}

export const schedulerRunRepository = new SchedulerRunRepositoryAdapter();
