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
} from "./types";

export interface ICrewTaskRepository {
  findAll(
    orgId: string,
    filters?: ListCrewTasksFilters,
  ): Promise<CrewTaskEntity[]>;

  findById(orgId: string, id: string): Promise<CrewTaskEntity | null>;

  create(command: CreateCrewTaskCommand): Promise<CrewTaskEntity>;

  update(
    orgId: string,
    id: string,
    patch: UpdateCrewTaskCommand,
  ): Promise<CrewTaskEntity | null>;

  delete(orgId: string, id: string): Promise<boolean>;
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
    actor?: CrewTaskActor,
  ): Promise<void>;

  onDeleted(task: CrewTaskEntity, actor?: CrewTaskActor): Promise<void>;
}
