/**
 * Crew Task Application Service
 * Orchestrates domain logic using ports (interfaces).
 *
 * Mutations fire best-effort side effects (audit trail, notifications,
 * websocket broadcast) through the optional effects port. Effect failures
 * never block or roll back the underlying task mutation.
 */

import type { ICrewTaskRepository, ICrewTaskEffects } from "../domain/ports";
import type {
  CrewTaskEntity,
  CreateCrewTaskCommand,
  UpdateCrewTaskCommand,
  ListCrewTasksFilters,
  CrewTaskActor,
} from "../domain/types";

/** Columns whose changes are tracked for audit + notification logic. */
const TRACKED_FIELDS: Array<keyof CrewTaskEntity> = [
  "vesselId",
  "assignedCrewId",
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "blockedReason",
];

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

export class CrewTaskApplicationService {
  constructor(
    private readonly repo: ICrewTaskRepository,
    private readonly effects?: ICrewTaskEffects,
  ) {}

  async listTasks(
    orgId: string,
    filters?: ListCrewTasksFilters,
  ): Promise<CrewTaskEntity[]> {
    return this.repo.findAll(orgId, filters);
  }

  async getTask(orgId: string, id: string): Promise<CrewTaskEntity | null> {
    return this.repo.findById(orgId, id);
  }

  async createTask(
    command: CreateCrewTaskCommand,
    actor?: CrewTaskActor,
  ): Promise<CrewTaskEntity> {
    const task = await this.repo.create(command);
    await this.effects?.onCreated(task, actor);
    return task;
  }

  async updateTask(
    orgId: string,
    id: string,
    patch: UpdateCrewTaskCommand,
    actor?: CrewTaskActor,
  ): Promise<CrewTaskEntity | null> {
    const before = await this.repo.findById(orgId, id);
    if (!before) return null;

    const after = await this.repo.update(orgId, id, patch);
    if (!after) return null;

    const changedFields = TRACKED_FIELDS.filter(
      (field) => !valuesEqual(before[field], after[field]),
    ).map((field) => String(field));

    if (changedFields.length > 0) {
      await this.effects?.onUpdated(before, after, changedFields, actor);
    }
    return after;
  }

  async deleteTask(
    orgId: string,
    id: string,
    actor?: CrewTaskActor,
  ): Promise<boolean> {
    const before = await this.repo.findById(orgId, id);
    if (!before) return false;

    const deleted = await this.repo.delete(orgId, id);
    if (deleted) {
      await this.effects?.onDeleted(before, actor);
    }
    return deleted;
  }
}
