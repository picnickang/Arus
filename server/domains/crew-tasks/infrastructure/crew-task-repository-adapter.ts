/**
 * Crew Task Infrastructure - Repository Adapter
 * Implements ICrewTaskRepository using Drizzle ORM (cloud/PostgreSQL).
 */

import type { ICrewTaskRepository } from "../domain/ports";
import type {
  CrewTaskEntity,
  CreateCrewTaskCommand,
  UpdateCrewTaskCommand,
  ListCrewTasksFilters,
} from "../domain/types";
import { db } from "../../../db";
import { crewTasks, type CrewTask, type InsertCrewTask } from "@shared/schema-runtime";
import { and, desc, eq, ne, type SQL } from "drizzle-orm";

export class CrewTaskRepositoryAdapter implements ICrewTaskRepository {
  async findAll(
    orgId: string,
    filters?: ListCrewTasksFilters,
  ): Promise<CrewTaskEntity[]> {
    const conditions: SQL[] = [eq(crewTasks.orgId, orgId)];

    if (filters?.vesselId) {
      conditions.push(eq(crewTasks.vesselId, filters.vesselId));
    }
    if (filters?.assignedCrewId) {
      conditions.push(eq(crewTasks.assignedCrewId, filters.assignedCrewId));
    }
    if (filters?.status) {
      conditions.push(eq(crewTasks.status, filters.status));
    } else if (!filters?.includeDone) {
      // Default board view hides completed tasks.
      conditions.push(ne(crewTasks.status, "done"));
    }

    const rows = await db
      .select()
      .from(crewTasks)
      .where(and(...conditions))
      .orderBy(desc(crewTasks.createdAt));

    return rows.map((row) => this.mapToEntity(row));
  }

  async findById(orgId: string, id: string): Promise<CrewTaskEntity | null> {
    const [row] = await db
      .select()
      .from(crewTasks)
      .where(and(eq(crewTasks.orgId, orgId), eq(crewTasks.id, id)))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async create(command: CreateCrewTaskCommand): Promise<CrewTaskEntity> {
    const insertValues: InsertCrewTask = {
      orgId: command.orgId,
      vesselId: command.vesselId ?? null,
      assignedCrewId: command.assignedCrewId ?? null,
      title: command.title,
      description: command.description ?? null,
      status: command.status ?? "open",
      priority: command.priority ?? "medium",
      dueDate: command.dueDate ? new Date(command.dueDate) : null,
      blockedReason: command.blockedReason ?? null,
      assignedTo: command.assignedTo ?? null,
      linkedSourceType: command.linkedSourceType ?? null,
      linkedSourceId: command.linkedSourceId ?? null,
      linkedSourceLabel: command.linkedSourceLabel ?? null,
      createdBy: command.createdBy ?? null,
    };

    const [created] = await db.insert(crewTasks).values(insertValues).returning();
    if (!created) {
      throw new Error("CrewTaskRepository.create: insert returned no row");
    }
    return this.mapToEntity(created);
  }

  async update(
    orgId: string,
    id: string,
    patch: UpdateCrewTaskCommand,
  ): Promise<CrewTaskEntity | null> {
    const updateValues: Partial<typeof crewTasks.$inferInsert> & {
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (patch.vesselId !== undefined) {updateValues.vesselId = patch.vesselId;}
    if (patch.assignedCrewId !== undefined)
      {updateValues.assignedCrewId = patch.assignedCrewId;}
    if (patch.title !== undefined) {updateValues.title = patch.title;}
    if (patch.description !== undefined)
      {updateValues.description = patch.description;}
    if (patch.status !== undefined) {updateValues.status = patch.status;}
    if (patch.priority !== undefined) {updateValues.priority = patch.priority;}
    if (patch.dueDate !== undefined)
      {updateValues.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;}
    if (patch.blockedReason !== undefined)
      {updateValues.blockedReason = patch.blockedReason;}
    if (patch.assignedTo !== undefined)
      {updateValues.assignedTo = patch.assignedTo;}
    if (patch.linkedSourceType !== undefined)
      {updateValues.linkedSourceType = patch.linkedSourceType;}
    if (patch.linkedSourceId !== undefined)
      {updateValues.linkedSourceId = patch.linkedSourceId;}
    if (patch.linkedSourceLabel !== undefined)
      {updateValues.linkedSourceLabel = patch.linkedSourceLabel;}

    const [updated] = await db
      .update(crewTasks)
      .set(updateValues)
      .where(and(eq(crewTasks.orgId, orgId), eq(crewTasks.id, id)))
      .returning();

    return updated ? this.mapToEntity(updated) : null;
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const deleted = await db
      .delete(crewTasks)
      .where(and(eq(crewTasks.orgId, orgId), eq(crewTasks.id, id)))
      .returning({ id: crewTasks.id });
    return deleted.length > 0;
  }

  private mapToEntity(row: CrewTask): CrewTaskEntity {
    return {
      id: row.id,
      orgId: row.orgId,
      vesselId: row.vesselId,
      assignedCrewId: row.assignedCrewId,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueDate: row.dueDate,
      blockedReason: row.blockedReason,
      assignedTo: row.assignedTo,
      linkedSourceType: row.linkedSourceType,
      linkedSourceId: row.linkedSourceId,
      linkedSourceLabel: row.linkedSourceLabel,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const crewTaskRepository = new CrewTaskRepositoryAdapter();
