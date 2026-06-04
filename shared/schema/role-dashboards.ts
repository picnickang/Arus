/**
 * Schema: Role Dashboards & User Vessel Assignments
 *
 * Cloud-only (PostgreSQL) domain — mirrors the safety-bulletins pattern:
 * not registered in schema-runtime and has no SQLite mirror.
 *
 * - role_dashboard_configs: per-role User-page config (widgets, task sources,
 *   visibility scope, quick actions, filters, high-impact questions) stored as
 *   validated JSON.
 * - user_vessel_assignments: which vessel(s)/fleet + department a user is
 *   assigned to (null vesselId => fleet-wide).
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  jsonb,
  boolean,
  timestamp,
  unique,
  index,
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";
import { roles } from "./permissions";
import { vessels } from "./vessels";

export const roleDashboardConfigs = pgTable(
  "role_dashboard_configs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    roleId: varchar("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    configJson: jsonb("config_json").notNull(),
    updatedBy: varchar("updated_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgRoleUnique: unique("uq_role_dashboard_org_role").on(table.orgId, table.roleId),
    orgIdx: index("idx_role_dashboard_org").on(table.orgId),
  }),
);

export const userVesselAssignments = pgTable(
  "user_vessel_assignments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: varchar("user_id").notNull(),
    // Null vesselId => fleet-wide assignment.
    vesselId: varchar("vessel_id").references(() => vessels.id),
    department: text("department"),
    isActive: boolean("is_active").notNull().default(true),
    assignedBy: varchar("assigned_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgUserVesselUnique: unique("uq_user_vessel").on(table.orgId, table.userId, table.vesselId),
    orgUserIdx: index("idx_user_vessel_org_user").on(table.orgId, table.userId),
  }),
);

/**
 * Per-account dashboard personalization layered on top of the role config.
 * Stores ONLY the user's personal tweaks (hidden widgets, custom order,
 * per-widget setting overrides, preferred landing route). Resolution intersects
 * these with what the access level + job already allow — it never widens access.
 */
export const userDashboardPreferences = pgTable(
  "user_dashboard_preferences",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: varchar("user_id").notNull(),
    prefsJson: jsonb("prefs_json").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgUserUnique: unique("uq_user_dashboard_prefs").on(table.orgId, table.userId),
    orgUserIdx: index("idx_user_dashboard_prefs_org_user").on(table.orgId, table.userId),
  }),
);

export const insertRoleDashboardConfigSchema = createInsertSchema(roleDashboardConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserDashboardPreferenceSchema = createInsertSchema(userDashboardPreferences).omit({
  id: true,
  updatedAt: true,
});

export const insertUserVesselAssignmentSchema = createInsertSchema(userVesselAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RoleDashboardConfigRow = typeof roleDashboardConfigs.$inferSelect;
export type InsertRoleDashboardConfigRow = z.infer<typeof insertRoleDashboardConfigSchema>;
export type UserVesselAssignment = typeof userVesselAssignments.$inferSelect;
export type InsertUserVesselAssignment = z.infer<typeof insertUserVesselAssignmentSchema>;
export type UserDashboardPreferenceRow = typeof userDashboardPreferences.$inferSelect;
export type InsertUserDashboardPreferenceRow = z.infer<typeof insertUserDashboardPreferenceSchema>;

/**
 * Shape of the JSON stored in `user_dashboard_preferences.prefs_json`. Kept as
 * a shared schema so both me-portal (read/write) and the client (optimistic
 * updates) validate the same structure. All fields optional — a missing field
 * means "inherit the role default".
 */
export const userDashboardPrefsSchema = z.object({
  hiddenWidgets: z.array(z.string()).optional(),
  widgetOrder: z.array(z.string()).optional(),
  widgetSettings: z.record(z.record(z.unknown())).optional(),
  landingRoute: z.string().optional(),
});
export type UserDashboardPrefs = z.infer<typeof userDashboardPrefsSchema>;
