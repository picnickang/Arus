/**
 * Schema: Crew Tasks
 *
 * Crew task tracker — lightweight, assignable tasks for crew members
 * (e.g. "inspect bilge pump", "renew STCW cert"). A first-class entity in
 * its own table, NOT derived from or written into work orders or
 * maintenance schedules.
 *
 * Cloud-only (PostgreSQL) domain — mirrors the safety-bulletins pattern:
 * not registered in schema-runtime and has no SQLite mirror. The table is
 * created by `server/migrations/029-crew-tasks.sql`.
 */

import { sql, pgTable, text, varchar, timestamp, jsonb, createInsertSchema, z } from "./base";
import { organizations } from "./core";
import { vessels } from "./vessels";
import { crew } from "./crew";

export const CREW_TASK_STATUSES = [
  "open",
  "in_progress",
  "blocked",
  "done",
] as const;

export const CREW_TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

/**
 * A task can reference an existing crew record (a crew document or a
 * certificate) as its "linked source" — e.g. "renew this expiring visa".
 * We reuse the existing crew documents / certificates data rather than
 * inventing a new document store.
 */
export const CREW_TASK_LINKED_SOURCE_TYPES = [
  "crew_document",
  "certificate",
] as const;

/** Activity-log event kinds (auto-created system events + user comments). */
export const CREW_TASK_EVENT_TYPES = [
  "created",
  "status_changed",
  "reassigned",
  "owner_changed",
  "linked_source",
  "comment",
] as const;

export const crewTasks = pgTable(
  "crew_tasks",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    // Null vesselId => not tied to a specific vessel (fleet/general task).
    vesselId: varchar("vessel_id").references(() => vessels.id),
    // Null assignedCrewId => unassigned task.
    assignedCrewId: varchar("assigned_crew_id").references(() => crew.id, {
      onDelete: "set null",
    }),

    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("medium"),
    dueDate: timestamp("due_date", { mode: "date" }),
    blockedReason: text("blocked_reason"),

    // Owner / actor responsible for the task — distinct from the crew member
    // the task is *about* (`assignedCrewId`). Free-text (e.g. "Crewing Admin").
    assignedTo: text("assigned_to"),

    // Optional link to an existing crew document / certificate (the "linked
    // source"). Type + id point at the source; label is a snapshot so the chip
    // stays readable even if the source is later renamed.
    linkedSourceType: text("linked_source_type"),
    linkedSourceId: varchar("linked_source_id"),
    linkedSourceLabel: text("linked_source_label"),

    createdBy: varchar("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_crew_tasks_org_status ON crew_tasks (${table.orgId}, ${table.status}, ${table.dueDate})`,
    orgAssignedIdx: sql`CREATE INDEX IF NOT EXISTS idx_crew_tasks_org_assigned ON crew_tasks (${table.orgId}, ${table.assignedCrewId})`,
  }),
);

export const insertCrewTaskSchema = createInsertSchema(crewTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CrewTask = typeof crewTasks.$inferSelect;
export type InsertCrewTask = z.infer<typeof insertCrewTaskSchema>;
export type CrewTaskStatus = (typeof CREW_TASK_STATUSES)[number];
export type CrewTaskPriority = (typeof CREW_TASK_PRIORITIES)[number];
export type CrewTaskLinkedSourceType =
  (typeof CREW_TASK_LINKED_SOURCE_TYPES)[number];

/**
 * Activity-log entry for a crew task: auto-created system events (created,
 * status changed, reassigned, owner/linked-source changed) and free-text
 * user comments. Cloud-only, mirrors the crew-tasks pattern. Created by
 * `server/migrations/030-crew-task-events-and-fields.sql`.
 */
export const crewTaskEvents = pgTable(
  "crew_task_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    taskId: varchar("task_id")
      .notNull()
      .references(() => crewTasks.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    message: text("message").notNull(),
    actorId: varchar("actor_id"),
    actorName: text("actor_name"),
    actorRole: text("actor_role"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    taskIdx: sql`CREATE INDEX IF NOT EXISTS idx_crew_task_events_task ON crew_task_events (${table.taskId}, ${table.createdAt})`,
  }),
);

export const insertCrewTaskEventSchema = createInsertSchema(crewTaskEvents).omit({
  id: true,
  createdAt: true,
});

export type CrewTaskEvent = typeof crewTaskEvents.$inferSelect;
export type InsertCrewTaskEvent = z.infer<typeof insertCrewTaskEventSchema>;
export type CrewTaskEventType = (typeof CREW_TASK_EVENT_TYPES)[number];
