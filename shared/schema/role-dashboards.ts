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

export const insertRoleDashboardConfigSchema = createInsertSchema(roleDashboardConfigs).omit({
  id: true,
  createdAt: true,
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
