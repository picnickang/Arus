/**
 * Schedule Assignment Repository Adapter
 * Implements IScheduleAssignmentRepository using existing storage
 */

import type { IScheduleAssignmentRepository } from '../domain/ports.js';
import type { ScheduleAssignmentEntity } from '../domain/types.js';
import { storage } from '../../../storage';

function mapToEntity(assignment: any): ScheduleAssignmentEntity {
  return {
    id: assignment.id,
    runId: assignment.runId,
    crewId: assignment.crewId,
    vesselId: assignment.vesselId,
    date: assignment.date ? new Date(assignment.date) : new Date(),
    shift: assignment.shift,
    role: assignment.role,
    status: assignment.status,
    createdAt: assignment.createdAt ? new Date(assignment.createdAt) : new Date(),
  };
}

export class ScheduleAssignmentRepositoryAdapter implements IScheduleAssignmentRepository {
  async createBulk(assignments: Omit<ScheduleAssignmentEntity, 'id' | 'createdAt'>[]): Promise<void> {
    await storage.createBulkScheduleAssignments(assignments as any[]);
  }

  async findByRunId(runId: string): Promise<ScheduleAssignmentEntity[]> {
    const assignments = await storage.getScheduleAssignmentsByRun(runId);
    return assignments.map(mapToEntity);
  }

  async findByDateRange(orgId: string, fromDate: Date, toDate: Date): Promise<ScheduleAssignmentEntity[]> {
    const assignments = await storage.getScheduleAssignments(orgId, fromDate, toDate);
    return assignments.map(mapToEntity);
  }

  async deleteByDateRange(orgId: string, start: Date, end: Date, mode?: string): Promise<number> {
    return storage.deleteScheduleAssignmentsByDateRange(orgId, start, end, mode);
  }
}

export const scheduleAssignmentRepository = new ScheduleAssignmentRepositoryAdapter();
