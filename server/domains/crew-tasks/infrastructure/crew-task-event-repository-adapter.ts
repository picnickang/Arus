/**
 * Crew Task Infrastructure - Event Repository Adapter
 * Implements ICrewTaskEventRepository using Drizzle ORM (cloud/PostgreSQL).
 * Backs the per-task activity log (auto system events + user comments).
 */

import type { ICrewTaskEventRepository } from "../domain/ports";
import type {
  CrewTaskEventEntity,
  CreateCrewTaskEventCommand,
} from "../domain/types";
import { db } from "../../../db";
import {
  crewTaskEvents,
  type CrewTaskEvent,
  type InsertCrewTaskEvent,
} from "@shared/schema";
import { and, asc, eq } from "drizzle-orm";

export class CrewTaskEventRepositoryAdapter
  implements ICrewTaskEventRepository
{
  async listByTask(
    orgId: string,
    taskId: string,
  ): Promise<CrewTaskEventEntity[]> {
    const rows = await db
      .select()
      .from(crewTaskEvents)
      .where(
        and(
          eq(crewTaskEvents.orgId, orgId),
          eq(crewTaskEvents.taskId, taskId),
        ),
      )
      .orderBy(asc(crewTaskEvents.createdAt));

    return rows.map((row) => this.mapToEntity(row));
  }

  async add(
    command: CreateCrewTaskEventCommand,
  ): Promise<CrewTaskEventEntity> {
    const insertValues: InsertCrewTaskEvent = {
      orgId: command.orgId,
      taskId: command.taskId,
      eventType: command.eventType,
      message: command.message,
      actorId: command.actorId ?? null,
      actorName: command.actorName ?? null,
      actorRole: command.actorRole ?? null,
      metadata: command.metadata ?? null,
    };

    const [created] = await db
      .insert(crewTaskEvents)
      .values(insertValues)
      .returning();
    if (!created) {
      throw new Error(
        "CrewTaskEventRepository.add: insert returned no row",
      );
    }
    return this.mapToEntity(created);
  }

  private mapToEntity(row: CrewTaskEvent): CrewTaskEventEntity {
    return {
      id: row.id,
      orgId: row.orgId,
      taskId: row.taskId,
      eventType: row.eventType,
      message: row.message,
      actorId: row.actorId,
      actorName: row.actorName,
      actorRole: row.actorRole,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt,
    };
  }
}

export const crewTaskEventRepository = new CrewTaskEventRepositoryAdapter();
