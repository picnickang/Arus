/**
 * Crew Task Domain - Ports (Interfaces)
 * Contracts implemented by infrastructure adapters.
 */

import type {
  CrewTaskEntity,
  CreateCrewTaskCommand,
  UpdateCrewTaskCommand,
  ListCrewTasksFilters,
  CrewTaskActor,
  CrewTaskEventEntity,
  CreateCrewTaskEventCommand,
} from "./types";

export interface ICrewTaskRepository {
  findAll(orgId: string, filters?: ListCrewTasksFilters): Promise<CrewTaskEntity[]>;

  findById(orgId: string, id: string): Promise<CrewTaskEntity | null>;

  create(command: CreateCrewTaskCommand): Promise<CrewTaskEntity>;

  update(orgId: string, id: string, patch: UpdateCrewTaskCommand): Promise<CrewTaskEntity | null>;

  delete(orgId: string, id: string): Promise<boolean>;
}

/** Activity-log persistence (auto system events + user comments). */
export interface ICrewTaskEventRepository {
  listByTask(orgId: string, taskId: string): Promise<CrewTaskEventEntity[]>;

  add(command: CreateCrewTaskEventCommand): Promise<CrewTaskEventEntity>;
}

/**
 * Side effects fired after a successful mutation: audit trail, assignee
 * notifications, and websocket broadcast. Implementations MUST be
 * best-effort (never throw) so a failed notification cannot roll back the
 * task mutation.
 */
export interface ICrewTaskEffects {
  onCreated(task: CrewTaskEntity, actor?: CrewTaskActor): Promise<void>;

  onUpdated(
    before: CrewTaskEntity,
    after: CrewTaskEntity,
    changedFields: string[],
    actor?: CrewTaskActor
  ): Promise<void>;

  onDeleted(task: CrewTaskEntity, actor?: CrewTaskActor): Promise<void>;

  /** A user comment was added — broadcast so open detail views refresh. */
  onCommented(
    task: CrewTaskEntity,
    event: CrewTaskEventEntity,
    actor?: CrewTaskActor
  ): Promise<void>;
}
