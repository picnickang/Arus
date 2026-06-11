/**
 * Pure helpers for the Crew Task Tracker.
 *
 * No React / network here — these functions are unit-tested directly and
 * reused by the Tasks view, the landing tile, and the attention feed.
 */

import { differenceInDays } from "date-fns";
import type { CrewTaskStatus, CrewTaskPriority } from "@shared/schema";

/** Shape the API returns: dates are JSON strings, not `Date` objects. */
export interface CrewTaskView {
  id: string;
  orgId: string;
  vesselId: string | null;
  assignedCrewId: string | null;
  title: string;
  description: string | null;
  status: CrewTaskStatus;
  priority: CrewTaskPriority;
  dueDate: string | null;
  blockedReason: string | null;
  assignedTo: string | null;
  linkedSourceType: string | null;
  linkedSourceId: string | null;
  linkedSourceLabel: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** One activity-log entry: an auto system event or a user comment. */
export interface CrewTaskEventView {
  id: string;
  orgId: string;
  taskId: string;
  eventType: string;
  message: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}

const PRIORITY_RANK: Record<CrewTaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const ACTIVE_STATUSES: readonly CrewTaskStatus[] = ["open", "in_progress", "blocked"];

export function isDone(task: CrewTaskView): boolean {
  return task.status === "done";
}

export function isActive(task: CrewTaskView): boolean {
  return !isDone(task);
}

/**
 * A task is overdue when it has a due date in the past and is not done.
 * `now` is injectable so tests are deterministic.
 */
export function isOverdue(task: CrewTaskView, now: Date = new Date()): boolean {
  if (isDone(task) || !task.dueDate) {
    return false;
  }
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  return due.getTime() < now.getTime();
}

/** Due within the next 7 days (and not already overdue / done). */
export function isDueThisWeek(task: CrewTaskView, now: Date = new Date()): boolean {
  if (isDone(task) || !task.dueDate) {
    return false;
  }
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  const ms = due.getTime() - now.getTime();
  const week = 7 * 24 * 60 * 60 * 1000;
  return ms >= 0 && ms <= week;
}

export function isBlocked(task: CrewTaskView): boolean {
  return task.status === "blocked";
}

export interface CrewTaskCounts {
  active: number;
  overdue: number;
  dueThisWeek: number;
  blocked: number;
}

export function countTasks(tasks: CrewTaskView[], now: Date = new Date()): CrewTaskCounts {
  let active = 0;
  let overdue = 0;
  let dueThisWeek = 0;
  let blocked = 0;
  for (const task of tasks) {
    if (isActive(task)) {
      active += 1;
    }
    if (isOverdue(task, now)) {
      overdue += 1;
    }
    if (isDueThisWeek(task, now)) {
      dueThisWeek += 1;
    }
    if (isBlocked(task)) {
      blocked += 1;
    }
  }
  return { active, overdue, dueThisWeek, blocked };
}

/**
 * Sort overdue first, then by priority (urgent→low), then by soonest due
 * date, then alphabetically. Stable and pure (does not mutate input).
 */
export function sortTasks(tasks: CrewTaskView[], now: Date = new Date()): CrewTaskView[] {
  return [...tasks].sort((a, b) => {
    const aOverdue = isOverdue(a, now) ? 0 : 1;
    const bOverdue = isOverdue(b, now) ? 0 : 1;
    if (aOverdue !== bOverdue) {
      return aOverdue - bOverdue;
    }

    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) {
      return byPriority;
    }

    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDue !== bDue) {
      return aDue - bDue;
    }

    return a.title.localeCompare(b.title);
  });
}

export type CrewTaskFilter = "all" | "mine" | "overdue" | "by_vessel";

/** Apply the active filter chip + free-text search to the task list. */
export function filterTasks(
  tasks: CrewTaskView[],
  options: {
    filter: CrewTaskFilter;
    search?: string;
    /** Ids of tasks assigned to the signed-in user (from `/api/me/tasks`). */
    myTaskIds?: ReadonlySet<string>;
    vesselId?: string | null;
    now?: Date;
  }
): CrewTaskView[] {
  const { filter, search, myTaskIds, vesselId, now = new Date() } = options;
  const query = (search ?? "").trim().toLowerCase();
  return tasks.filter((task) => {
    if (filter === "mine" && !(myTaskIds?.has(task.id) ?? false)) {
      return false;
    }
    if (filter === "overdue" && !isOverdue(task, now)) {
      return false;
    }
    if (filter === "by_vessel" && vesselId && task.vesselId !== vesselId) {
      return false;
    }
    if (query) {
      const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

const STATUS_LABELS: Record<CrewTaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

const PRIORITY_LABELS: Record<CrewTaskPriority, string> = {
  low: "Low",
  medium: "Normal",
  high: "High",
  urgent: "Critical",
};

export function statusLabel(status: CrewTaskStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function priorityLabel(priority: CrewTaskPriority): string {
  return PRIORITY_LABELS[priority] ?? priority;
}

/** Visual tone for a status chip — maps to Tailwind colour families. */
export type ChipTone = "slate" | "blue" | "amber" | "green";

const STATUS_TONES: Record<CrewTaskStatus, ChipTone> = {
  open: "slate",
  in_progress: "blue",
  blocked: "amber",
  done: "green",
};

export function statusTone(status: CrewTaskStatus): ChipTone {
  return STATUS_TONES[status] ?? "slate";
}

const PRIORITY_TONES: Record<CrewTaskPriority, ChipTone> = {
  low: "slate",
  medium: "blue",
  high: "amber",
  urgent: "amber",
};

export function priorityTone(priority: CrewTaskPriority): ChipTone {
  return PRIORITY_TONES[priority] ?? "slate";
}

/**
 * Human label for an activity-event type (system events + comments).
 * Falls back to the raw type so unknown future events stay readable.
 */
const EVENT_TYPE_LABELS: Record<string, string> = {
  created: "Created",
  status_changed: "Status changed",
  reassigned: "Reassigned",
  owner_changed: "Owner changed",
  linked_source: "Linked source",
  comment: "Comment",
};

export function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

/**
 * Pure decision for the document renewal-reminder task.
 *
 * A saved/renewed crew document raises a linked renewal task when it is at or
 * within `leadDays` of expiry. It must NEVER spawn a duplicate, so it skips when
 * an open task already links the same document. Priority escalates to `high`
 * inside 30 days (including already-expired). Keeping this pure means the dedupe
 * window + priority rules are unit-tested without React or the network.
 */
export interface RenewalTaskDecision {
  shouldRaise: boolean;
  priority: CrewTaskPriority;
  daysUntilExpiry: number;
}

export function decideRenewalTask(args: {
  docId: string;
  expiresAt?: string | null;
  leadDays: number;
  openTasks: Pick<CrewTaskView, "linkedSourceType" | "linkedSourceId">[];
  now?: Date;
}): RenewalTaskDecision {
  const { docId, expiresAt, leadDays, openTasks, now = new Date() } = args;
  if (!expiresAt) {
    return { shouldRaise: false, priority: "medium", daysUntilExpiry: Number.NaN };
  }
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return { shouldRaise: false, priority: "medium", daysUntilExpiry: Number.NaN };
  }
  // Use date-fns `differenceInDays` to stay byte-for-byte identical with the
  // prior inline rule (`differenceInDays(new Date(expiresAt), new Date())`) —
  // truncated full-day difference, so edge boundaries don't shift.
  const days = differenceInDays(expiry, now);
  const priority: CrewTaskPriority = days <= 30 ? "high" : "medium";
  if (days > leadDays) {
    return { shouldRaise: false, priority, daysUntilExpiry: days };
  }
  const alreadyOpen = openTasks.some(
    (t) => t.linkedSourceType === "crew_document" && t.linkedSourceId === docId
  );
  return { shouldRaise: !alreadyOpen, priority, daysUntilExpiry: days };
}

/** Human "due in 3 days" / "overdue 2 days" / "due today" string. */
export function dueLabel(dueDate: string | null, now: Date = new Date()): string | null {
  if (!dueDate) {
    return null;
  }
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const days = Math.round((startOfDue - startOfToday) / dayMs);
  if (days === 0) {
    return "Due today";
  }
  if (days < 0) {
    return `Overdue ${Math.abs(days)}d`;
  }
  return `Due in ${days}d`;
}
