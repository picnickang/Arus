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

// Resources (pages/features) that can be protected
export const permissionResources = pgTable(
  "permission_resources",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    icon: text("icon"),
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").default(true),
  }
);

// Actions that can be performed on resources
export const permissionActions = pgTable(
  "permission_actions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    riskLevel: text("risk_level").default("low"),
    sortOrder: integer("sort_order").default(0),
  }
);

// Available actions for each resource (many-to-many)
export const resourceActions = pgTable(
  "resource_actions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    resourceId: varchar("resource_id")
      .notNull()
      .references(() => permissionResources.id, { onDelete: "cascade" }),
    actionId: varchar("action_id")
      .notNull()
      .references(() => permissionActions.id, { onDelete: "cascade" }),
    isDefault: boolean("is_default").default(false),
  },
  (table) => ({
    resourceActionUnique: unique("uq_resource_actions").on(table.resourceId, table.actionId),
  })
);

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

// Role templates for quick setup
export const roleTemplates = pgTable(
  "role_templates",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull().unique(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    department: text("department"),
    hierarchyLevel: integer("hierarchy_level").notNull().default(50),
    permissions: text("permissions").notNull(),
    fleetType: text("fleet_type"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  }
);

// Permission audit log for tracking changes
export const permissionAuditLog = pgTable(
  "permission_audit_log",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: varchar("user_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: varchar("target_id"),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgTimeIdx: index("idx_permission_audit_org_time").on(table.orgId, table.createdAt),
  })
);

// User role assignments (users can have multiple roles)
export const userRoleAssignments = pgTable(
  "user_role_assignments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: varchar("user_id").notNull(),
    roleId: varchar("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedBy: varchar("assigned_by"),
    assignedAt: timestamp("assigned_at", { mode: "date" }).defaultNow(),
    expiresAt: timestamp("expires_at", { mode: "date" }),
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
    name: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/, "Must be lowercase with underscores"),
    displayName: z.string().min(2).max(100),
    department: z.enum(["bridge", "engine", "deck", "steward", "admin"]).optional(),
    hierarchyLevel: z.number().min(1).max(100).default(50),
  });

export const insertPermissionResourceSchema = createInsertSchema(permissionResources)
  .omit({ id: true })
  .extend({
    code: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/),
    name: z.string().min(2).max(100),
    category: z.enum([
      "operations",
      "maintenance",
      "crew",
      "inventory",
      "analytics",
      "compliance",
      "settings",
    ]),
  });

export const insertPermissionActionSchema = createInsertSchema(permissionActions)
  .omit({ id: true })
  .extend({
    code: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/),
    name: z.string().min(2).max(100),
    riskLevel: z.enum(["low", "medium", "high", "critical"]).default("low"),
  });

export const insertPermissionGrantSchema = createInsertSchema(permissionGrants)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    conditions: z.string().optional(),
  });

export const insertRoleTemplateSchema = createInsertSchema(roleTemplates)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/),
    displayName: z.string().min(2).max(100),
    permissions: z.string(),
    fleetType: z.enum(["deep_sea", "offshore", "cruise", "cargo", "tanker"]).optional(),
  });

export const insertUserRoleAssignmentSchema = createInsertSchema(userRoleAssignments)
  .omit({ id: true, assignedAt: true })
  .extend({
    expiresAt: z.date().optional(),
  });

// Types
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type PermissionResource = typeof permissionResources.$inferSelect;
export type InsertPermissionResource = z.infer<typeof insertPermissionResourceSchema>;
export type PermissionAction = typeof permissionActions.$inferSelect;
export type InsertPermissionAction = z.infer<typeof insertPermissionActionSchema>;
export type PermissionGrant = typeof permissionGrants.$inferSelect;
export type InsertPermissionGrant = z.infer<typeof insertPermissionGrantSchema>;
export type RoleTemplate = typeof roleTemplates.$inferSelect;
export type InsertRoleTemplate = z.infer<typeof insertRoleTemplateSchema>;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type InsertUserRoleAssignment = z.infer<typeof insertUserRoleAssignmentSchema>;
export type PermissionAuditEntry = typeof permissionAuditLog.$inferSelect;

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
