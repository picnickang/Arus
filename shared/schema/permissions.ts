/**
 * Schema Permissions - Role-Based Access Control (RBAC)
 *
 * Modular permission system for controlling access to resources and actions.
 * Designed for maritime fleet management with crew rank hierarchies.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  unique,
  index,
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";

// Custom roles defined by organization
export const roles = pgTable(
  "roles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    department: text("department"),
    hierarchyLevel: integer("hierarchy_level").notNull().default(50),
    parentRoleId: varchar("parent_role_id"),
    templateId: varchar("template_id"),
    permissions: text("permissions"),
    isSystemRole: boolean("is_system_role").default(false),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgNameUnique: unique("uq_roles_org_name").on(table.orgId, table.name),
    orgIdx: index("idx_roles_org").on(table.orgId),
    hierarchyIdx: index("idx_roles_hierarchy").on(table.orgId, table.hierarchyLevel),
  })
);

// NOTE: permission_resources, permission_actions, resource_actions tables do not
// exist in PostgreSQL — resource/action definitions live in
// server/config/permission-registry.ts. The following are pure TypeScript types
// (no Drizzle tables) so the existing API contracts can still be served from
// the static registry without claiming non-existent DB tables.
export interface PermissionResource {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  sortOrder: number | null;
  isActive: boolean | null;
}

export interface PermissionAction {
  id: string;
  code: string;
  name: string;
  description: string | null;
  riskLevel: string | null;
  sortOrder: number | null;
}

// Permission grants - maps roles to resource/action pairs
export const permissionGrants = pgTable(
  "permission_grants",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    roleId: varchar("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    resourceCode: text("resource_code").notNull(),
    actionCode: text("action_code").notNull(),
    isGranted: boolean("is_granted").default(true),
    condition: text("condition"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    createdBy: varchar("created_by"),
  },
  (table) => ({
    grantUnique: unique("uq_permission_grants").on(
      table.roleId,
      table.resourceCode,
      table.actionCode
    ),
    roleIdx: index("idx_permission_grants_role").on(table.roleId),
  })
);

// NOTE: role_templates and permission_audit_log tables do not exist in
// PostgreSQL. Templates live in server/config/default-role-templates.ts and
// audit entries are emitted via structured logging only. Types kept here for
// downstream consumers.
export interface RoleTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  department: string | null;
  hierarchyLevel: number;
  permissions: string;
  fleetType: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
}

export interface PermissionAuditEntry {
  id: string;
  orgId: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  previousValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  createdAt: Date | null;
}

// User role assignments (users can have multiple roles)
export const userRoleAssignments = pgTable(
  "user_role_assignments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").references(() => organizations.id),
    userId: varchar("user_id").notNull(),
    roleId: varchar("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedBy: varchar("assigned_by"),
    isActive: boolean("is_active").default(true),
  },
  (table) => ({
    userRoleUnique: unique("uq_user_role").on(table.orgId, table.userId, table.roleId),
    userIdx: index("idx_user_role_assignments_user").on(table.userId),
    roleIdx: index("idx_user_role_assignments_role").on(table.roleId),
  })
);

// Insert Schemas
export const insertRoleSchema = createInsertSchema(roles)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z
      .string()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9_]+$/, "Must be lowercase with underscores"),
    displayName: z.string().min(2).max(100),
    department: z.enum(["bridge", "engine", "deck", "steward", "admin"]).optional(),
    hierarchyLevel: z.number().min(1).max(100).default(50),
  });

export const insertPermissionResourceSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/),
  name: z.string().min(2).max(100),
  description: z.string().nullable().optional(),
  category: z.enum([
    "operations",
    "maintenance",
    "crew",
    "inventory",
    "analytics",
    "compliance",
    "settings",
  ]),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().nullable().optional(),
  isActive: z.boolean().nullable().optional(),
});

export const insertPermissionActionSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/),
  name: z.string().min(2).max(100),
  description: z.string().nullable().optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).default("low"),
  sortOrder: z.number().nullable().optional(),
});

export const insertPermissionGrantSchema = createInsertSchema(permissionGrants)
  .omit({ id: true, createdAt: true })
  .extend({
    conditions: z.string().optional(),
  });

export const insertRoleTemplateSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(2).max(100),
  description: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  hierarchyLevel: z.number().default(50),
  permissions: z.string(),
  fleetType: z.enum(["deep_sea", "offshore", "cruise", "cargo", "tanker"]).optional(),
  isActive: z.boolean().nullable().optional(),
});

export const insertUserRoleAssignmentSchema = createInsertSchema(userRoleAssignments).omit({
  id: true,
});

// Types
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type InsertPermissionResource = z.infer<typeof insertPermissionResourceSchema>;
export type InsertPermissionAction = z.infer<typeof insertPermissionActionSchema>;
export type PermissionGrant = typeof permissionGrants.$inferSelect;
export type InsertPermissionGrant = z.infer<typeof insertPermissionGrantSchema>;
export type InsertRoleTemplate = z.infer<typeof insertRoleTemplateSchema>;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type InsertUserRoleAssignment = z.infer<typeof insertUserRoleAssignmentSchema>;

// Permission check result type
export interface PermissionCheckResult {
  allowed: boolean;
  resource: string;
  action: string;
  reason?: string;
  conditions?: string;
}

// Compiled permission matrix for caching
export interface CompiledPermissions {
  userId: string;
  orgId: string;
  roles: string[];
  grants: Record<string, Record<string, { allowed: boolean; conditions?: string }>>;
  compiledAt: Date;
}
