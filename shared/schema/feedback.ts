/**
 * Schema: Pilot Feedback
 *
 * Crew-submitted feedback / issue flags from the user-portal Feedback page
 * (`/feedback`). Previously these lived only in the browser's sessionStorage
 * and were lost when the tab closed; this table is the durable backend the
 * client application module (`feedback-submission.ts`) was designed to grow
 * into.
 *
 * Cloud-only (PostgreSQL) domain — mirrors the crew-tasks pattern: exposed
 * through `schema-runtime` via `cloudOnly()` and created by
 * `server/migrations/031-pilot-feedback.sql` (no SQLite mirror).
 */

import { sql, pgTable, text, varchar, timestamp, createInsertSchema, z } from "./base";
import { organizations } from "./core";
import { workOrders } from "./work-orders";

export const PILOT_FEEDBACK_CATEGORIES = ["bug", "suggestion", "flag"] as const;
export const PILOT_FEEDBACK_SEVERITIES = ["low", "medium", "high"] as const;
export const PILOT_FEEDBACK_LOCATIONS = [
  "engine_room",
  "bridge",
  "deck",
  "accommodation",
  "cargo_hold",
  "other",
] as const;
/** Lifecycle as reviewed by office/admin staff; submitted is the only state crews set. */
export const PILOT_FEEDBACK_STATUSES = ["submitted", "acknowledged", "resolved"] as const;

export const pilotFeedback = pgTable(
  "pilot_feedback",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    // Submitting portal user. No FK — dev-login sessions reference synthetic
    // user ids that have no users row.
    userId: varchar("user_id").notNull(),
    /** Human-readable id shown to the crew member (FB-…); server-minted. */
    trackingId: varchar("tracking_id").notNull().unique(),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    location: text("location").notNull(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("submitted"),
    resolutionNote: text("resolution_note"),
    // Resolving staff may link the WO raised from this report. SET NULL so
    // deleting a work order never erases the crew member's report.
    linkedWorkOrderId: varchar("linked_work_order_id").references(() => workOrders.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgUserIdx: sql`CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org_user ON pilot_feedback (${table.orgId}, ${table.userId}, ${table.createdAt})`,
    orgStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org_status ON pilot_feedback (${table.orgId}, ${table.status})`,
  })
);

export const insertPilotFeedbackSchema = createInsertSchema(pilotFeedback).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** Payload the portal POSTs — server mints trackingId/status/user fields. */
export const pilotFeedbackDraftSchema = z.object({
  category: z.enum(PILOT_FEEDBACK_CATEGORIES),
  severity: z.enum(PILOT_FEEDBACK_SEVERITIES),
  location: z.enum(PILOT_FEEDBACK_LOCATIONS),
  subject: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
});

export type PilotFeedback = typeof pilotFeedback.$inferSelect;
export type InsertPilotFeedback = z.infer<typeof insertPilotFeedbackSchema>;
export type PilotFeedbackDraft = z.infer<typeof pilotFeedbackDraftSchema>;
export type PilotFeedbackStatus = (typeof PILOT_FEEDBACK_STATUSES)[number];
