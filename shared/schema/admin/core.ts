import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  unique,
  index,
  createInsertSchema,
  z,
} from "../base";
import { organizations, users } from "../core";

// ============================================================================
// ADMIN AUDIT EVENTS
// ============================================================================

export const adminAuditEvents = pgTable("admin_audit_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id"),
  details: jsonb("details").default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  outcome: text("outcome").notNull().default("success"),
  errorMessage: text("error_message"),
  severity: text("severity").notNull().default("info"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const insertAdminAuditEventSchema = createInsertSchema(adminAuditEvents)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    action: z.string().min(1),
    resourceType: z.string().min(1),
    outcome: z.enum(["success", "failure", "partial"]).default("success"),
    severity: z.enum(["info", "warning", "critical"]).default("info"),
  });

export type AdminAuditEvent = typeof adminAuditEvents.$inferSelect;
export type InsertAdminAuditEvent = z.infer<typeof insertAdminAuditEventSchema>;

// ============================================================================
// ADMIN SESSIONS
// ============================================================================

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
    userId: varchar("user_id").references(() => users.id),
    adminEmail: varchar("admin_email", { length: 255 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    lastActivityAt: timestamp("last_activity_at", { mode: "date" }).defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    sessionTokenIdx: index("idx_admin_sessions_token").on(table.sessionToken),
    expiresAtIdx: index("idx_admin_sessions_expires").on(table.expiresAt),
    orgIdIdx: index("idx_admin_sessions_org_id").on(table.orgId),
  })
);

export const insertAdminSessionSchema = createInsertSchema(adminSessions).omit({
  id: true,
  createdAt: true,
});

export type AdminSession = typeof adminSessions.$inferSelect;
export type InsertAdminSession = z.infer<typeof insertAdminSessionSchema>;

// ============================================================================
// ADMIN SYSTEM SETTINGS
// ============================================================================

export const adminSystemSettings = pgTable(
  "admin_system_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    category: text("category").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    dataType: text("data_type").notNull(),
    description: text("description"),
    isSecret: boolean("is_secret").default(false),
    isReadonly: boolean("is_readonly").default(false),
    validationRule: jsonb("validation_rule"),
    defaultValue: jsonb("default_value"),
    updatedBy: varchar("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniqueOrgCategoryKey: unique().on(table.orgId, table.category, table.key),
  })
);

export const insertAdminSystemSettingSchema = createInsertSchema(adminSystemSettings)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    category: z.string().min(1),
    key: z.string().min(1),
    dataType: z.enum(["string", "number", "boolean", "object", "array"]),
  });

export type AdminSystemSetting = typeof adminSystemSettings.$inferSelect;
export type InsertAdminSystemSetting = z.infer<typeof insertAdminSystemSettingSchema>;

// ============================================================================
// INTEGRATION CONFIGS
// ============================================================================

export const integrationConfigs = pgTable("integration_configs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("inactive"),
  config: jsonb("config").notNull(),
  credentials: jsonb("credentials"),
  lastHealthCheck: timestamp("last_health_check", { mode: "date" }),
  healthStatus: text("health_status").default("unknown"),
  errorCount: integer("error_count").default(0),
  lastError: text("last_error"),
  usageStats: jsonb("usage_stats").default({}),
  rateLimit: jsonb("rate_limit"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const insertIntegrationConfigSchema = createInsertSchema(integrationConfigs)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1),
    type: z.string().min(1),
    status: z.enum(["active", "inactive", "error", "testing"]).default("inactive"),
    healthStatus: z.enum(["healthy", "unhealthy", "unknown"]).optional(),
  });

export type IntegrationConfig = typeof integrationConfigs.$inferSelect;
export type InsertIntegrationConfig = z.infer<typeof insertIntegrationConfigSchema>;

// ============================================================================
// MAINTENANCE WINDOWS
// ============================================================================

export const maintenanceWindows = pgTable("maintenance_windows", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("low"),
  status: text("status").notNull().default("scheduled"),
  startTime: timestamp("start_time", { mode: "date" }).notNull(),
  endTime: timestamp("end_time", { mode: "date" }).notNull(),
  actualStartTime: timestamp("actual_start_time", { mode: "date" }),
  actualEndTime: timestamp("actual_end_time", { mode: "date" }),
  affectedServices: text("affected_services").array(),
  maintenanceTasks: jsonb("maintenance_tasks").default([]),
  completedTasks: jsonb("completed_tasks").default([]),
  rollbackPlan: text("rollback_plan"),
  createdBy: varchar("created_by").references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  notifyUsers: text("notify_users").array(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const insertMaintenanceWindowSchema = createInsertSchema(maintenanceWindows)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    title: z.string().min(1),
    type: z.enum(["database", "application", "infrastructure", "security"]),
    severity: z.enum(["low", "medium", "high", "critical"]).default("low"),
    status: z.enum(["scheduled", "active", "completed", "cancelled"]).default("scheduled"),
  });

export type MaintenanceWindow = typeof maintenanceWindows.$inferSelect;
export type InsertMaintenanceWindow = z.infer<typeof insertMaintenanceWindowSchema>;
