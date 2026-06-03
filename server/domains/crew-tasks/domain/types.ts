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
  /** Owner/actor responsible — distinct from the crew member it is about. */
  assignedTo: string | null;
  /** Optional link to an existing crew document / certificate. */
  linkedSourceType: string | null;
  linkedSourceId: string | null;
  linkedSourceLabel: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** An activity-log entry: an auto system event or a user comment. */
export interface CrewTaskEventEntity {
  id: string;
  orgId: string;
  taskId: string;
  eventType: string;
  message: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | null;
}

export interface CreateCrewTaskEventCommand {
  orgId: string;
  taskId: string;
  eventType: string;
  message: string;
  actorId?: string | undefined;
  actorName?: string | undefined;
  actorRole?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
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
  assignedTo?: string | undefined;
  linkedSourceType?: string | undefined;
  linkedSourceId?: string | undefined;
  linkedSourceLabel?: string | undefined;
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
  assignedTo?: string | null | undefined;
  linkedSourceType?: string | null | undefined;
  linkedSourceId?: string | null | undefined;
  linkedSourceLabel?: string | null | undefined;
}

export interface ListCrewTasksFilters {
  vesselId?: string | undefined;
  assignedCrewId?: string | undefined;
  status?: string | undefined;
  /** When false/omitted, completed ("done") tasks are hidden unless a
   *  specific `status` filter is supplied. */
  includeDone?: boolean | undefined;
}
