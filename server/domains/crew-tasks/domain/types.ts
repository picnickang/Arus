/**
 * Crew Task Domain - Domain Types
 * Pure domain types without infrastructure dependencies.
 */

export interface CrewTaskEntity {
  id: string;
  orgId: string;
  vesselId: string | null;
  assignedCrewId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  blockedReason: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Who triggered a mutation — used for audit trail + notifications. */
export interface CrewTaskActor {
  id?: string | undefined;
  name?: string | undefined;
  role?: string | undefined;
}

export interface CreateCrewTaskCommand {
  orgId: string;
  vesselId?: string | undefined;
  assignedCrewId?: string | undefined;
  title: string;
  description?: string | undefined;
  status?: string | undefined;
  priority?: string | undefined;
  dueDate?: string | undefined;
  blockedReason?: string | undefined;
  createdBy?: string | undefined;
}

/**
 * Partial update. `undefined` means "leave unchanged"; an explicit `null`
 * clears a nullable column (e.g. unassign a task, remove a due date).
 */
export interface UpdateCrewTaskCommand {
  vesselId?: string | null | undefined;
  assignedCrewId?: string | null | undefined;
  title?: string | undefined;
  description?: string | null | undefined;
  status?: string | undefined;
  priority?: string | undefined;
  dueDate?: string | null | undefined;
  blockedReason?: string | null | undefined;
}

export interface ListCrewTasksFilters {
  vesselId?: string | undefined;
  assignedCrewId?: string | undefined;
  status?: string | undefined;
  /** When false/omitted, completed ("done") tasks are hidden unless a
   *  specific `status` filter is supplied. */
  includeDone?: boolean | undefined;
}
