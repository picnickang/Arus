/**
 * Schema Admin - System Administration, Audit, Health Monitoring
 *
 * Includes admin sessions, audit events, system settings, integrations,
 * maintenance windows, health checks, and performance metrics.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  unique,
  index,
  numeric,
  createInsertSchema,
  z,
} from "./base";
import { organizations, users } from "./core";
import { vessels } from "./vessels";
import { equipment, devices } from "./equipment";

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

// ============================================================================
// SYSTEM PERFORMANCE METRICS
// ============================================================================

export const systemPerformanceMetrics = pgTable("system_performance_metrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  metricName: text("metric_name").notNull(),
  category: text("category").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  threshold: real("threshold"),
  status: text("status").default("normal"),
  tags: jsonb("tags").default({}),
  source: text("source").notNull(),
  recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow(),
});

export const insertSystemPerformanceMetricSchema = createInsertSchema(systemPerformanceMetrics)
  .omit({
    id: true,
    recordedAt: true,
  })
  .extend({
    metricName: z.string().min(1),
    category: z.enum(["system", "database", "application", "network"]),
    value: z.number(),
    unit: z.string().min(1),
    status: z.enum(["normal", "warning", "critical"]).optional(),
  });

export type SystemPerformanceMetric = typeof systemPerformanceMetrics.$inferSelect;
export type InsertSystemPerformanceMetric = z.infer<typeof insertSystemPerformanceMetricSchema>;

// ============================================================================
// SYSTEM HEALTH CHECKS
// ============================================================================

export const systemHealthChecks = pgTable("system_health_checks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  checkName: text("check_name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(),
  responseTime: integer("response_time_ms"),
  message: text("message"),
  details: jsonb("details").default({}),
  lastSuccess: timestamp("last_success", { mode: "date" }),
  consecutiveFailures: integer("consecutive_failures").default(0),
  isEnabled: boolean("is_enabled").default(true),
  checkInterval: integer("check_interval_seconds").default(300),
  timeoutSeconds: integer("timeout_seconds").default(30),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const insertSystemHealthCheckSchema = createInsertSchema(systemHealthChecks)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    checkName: z.string().min(1),
    category: z.enum(["infrastructure", "application", "external_service"]),
    status: z.enum(["healthy", "warning", "critical", "unknown"]),
  });

export type SystemHealthCheck = typeof systemHealthChecks.$inferSelect;
export type InsertSystemHealthCheck = z.infer<typeof insertSystemHealthCheckSchema>;

// ============================================================================
// CONFIG AUDIT LOG
// ============================================================================

export const configAuditLog = pgTable(
  "config_audit_log",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    key: varchar("key", { length: 255 }).notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changeType: varchar("change_type", { length: 20 }).notNull().default("update"),
    changedBy: varchar("changed_by").references(() => users.id),
    changedByName: text("changed_by_name"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    autoReload: boolean("auto_reload").default(false),
    requiresRestart: boolean("requires_restart").default(false),
    notes: text("notes"),
    changedAt: timestamp("changed_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    orgKeyIdx: index("idx_config_audit_org_key").on(table.orgId, table.key, table.changedAt),
    changedByIdx: index("idx_config_audit_user").on(table.changedBy, table.changedAt),
    timestampIdx: index("idx_config_audit_timestamp").on(table.changedAt),
  })
);

export const insertConfigAuditLogSchema = createInsertSchema(configAuditLog).omit({
  id: true,
  changedAt: true,
});

export type ConfigAuditLog = typeof configAuditLog.$inferSelect;
export type InsertConfigAuditLog = z.infer<typeof insertConfigAuditLogSchema>;

// ============================================================================
// AUDIT RUNS (AI Sensor Optimization)
// ============================================================================

export const auditRuns = pgTable(
  "audit_runs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    runType: varchar("run_type", { length: 50 }).notNull().default("manual"),
    status: varchar("status", { length: 20 }).notNull(),
    testResults: jsonb("test_results").notNull(),
    diagnosticMetrics: jsonb("diagnostic_metrics").notNull(),
    modelPerformance: jsonb("model_performance"),
    featureRankings: jsonb("feature_rankings"),
    totalTests: integer("total_tests").notNull(),
    testsPassed: integer("tests_passed").notNull(),
    testsFailed: integer("tests_failed").notNull(),
    executionTimeMs: integer("execution_time_ms"),
    triggeredBy: varchar("triggered_by", { length: 255 }),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("idx_audit_runs_org").on(table.orgId),
    statusIdx: index("idx_audit_runs_status").on(table.status),
    startedAtIdx: index("idx_audit_runs_started_at").on(table.startedAt),
    runTypeIdx: index("idx_audit_runs_run_type").on(table.runType),
  })
);

export const insertAuditRunSchema = createInsertSchema(auditRuns).omit({
  id: true,
  createdAt: true,
});

export type AuditRun = typeof auditRuns.$inferSelect;
export type InsertAuditRun = z.infer<typeof insertAuditRunSchema>;

// ============================================================================
// AUDIT WEBHOOK SUBSCRIPTIONS
// ============================================================================

export const auditWebhookSubscriptions = pgTable(
  "audit_webhook_subscriptions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    url: text("url").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: varchar("created_by", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    lastNotifiedAt: timestamp("last_notified_at", { mode: "date" }),
    failureCount: integer("failure_count").notNull().default(0),
    lastError: text("last_error"),
  },
  (table) => ({
    orgIdx: index("idx_webhook_subs_org").on(table.orgId),
    activeIdx: index("idx_webhook_subs_active").on(table.isActive),
    urlUnique: unique("webhook_url_unique").on(table.orgId, table.url),
  })
);

export const insertAuditWebhookSubscriptionSchema = createInsertSchema(
  auditWebhookSubscriptions
).omit({
  id: true,
  createdAt: true,
  failureCount: true,
});

export type AuditWebhookSubscription = typeof auditWebhookSubscriptions.$inferSelect;
export type InsertAuditWebhookSubscription = z.infer<typeof insertAuditWebhookSubscriptionSchema>;

// ============================================================================
// ERROR LOGS
// ============================================================================

export const errorLogs = pgTable(
  "error_logs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    timestamp: timestamp("timestamp", { mode: "date" }).defaultNow().notNull(),
    severity: text("severity").notNull(),
    category: text("category").notNull(),
    message: text("message").notNull(),
    stackTrace: text("stack_trace"),
    context: jsonb("context"),
    errorCode: text("error_code"),
    resolved: boolean("resolved").default(false),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    resolvedBy: varchar("resolved_by"),
  },
  (table) => ({
    timestampIndex: index("idx_error_logs_timestamp").on(table.timestamp),
    severityIndex: index("idx_error_logs_severity").on(table.severity),
    categoryIndex: index("idx_error_logs_category").on(table.category),
    resolvedIndex: index("idx_error_logs_resolved").on(table.resolved),
  })
);

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({
  id: true,
});

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;

// ============================================================================
// ENTITY OFFSETS (MQTT)
// ============================================================================

export const entityOffsets = pgTable(
  "entity_offsets",
  {
    vesselId: text("vessel_id").notNull(),
    entity: text("entity").notNull(),
    seq: numeric("seq", { precision: 20, scale: 0 })
      .notNull()
      .default(sql`0`),
  },
  (table) => ({
    pk: sql`PRIMARY KEY (vessel_id, entity)`,
  })
);

export const insertEntityOffsetSchema = createInsertSchema(entityOffsets);

export type EntityOffset = typeof entityOffsets.$inferSelect;
export type InsertEntityOffset = z.infer<typeof insertEntityOffsetSchema>;

// ============================================================================
// CONTEXT EVENTS
// ============================================================================

export const contextEvents = pgTable(
  "context_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    equipmentId: varchar("equipment_id").references(() => equipment.id),
    type: varchar("type", { length: 50 }).notNull(),
    timestamp: timestamp("timestamp", { mode: "date" }).notNull(),
    duration: integer("duration"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    severity: varchar("severity", { length: 20 }),
    metadata: jsonb("metadata"),
    createdBy: varchar("created_by", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("idx_context_events_org").on(table.orgId),
    vesselIdx: index("idx_context_events_vessel").on(table.vesselId),
    equipmentIdx: index("idx_context_events_equipment").on(table.equipmentId),
    timestampIdx: index("idx_context_events_timestamp").on(table.timestamp),
    typeIdx: index("idx_context_events_type").on(table.type),
  })
);

export const insertContextEventSchema = createInsertSchema(contextEvents).omit({
  id: true,
  createdAt: true,
});

export type ContextEvent = typeof contextEvents.$inferSelect;
export type InsertContextEvent = z.infer<typeof insertContextEventSchema>;

// ============================================================================
// USER SESSIONS
// ============================================================================

export const userSessions = pgTable(
  "user_sessions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
    refreshToken: varchar("refresh_token", { length: 255 }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", { mode: "date" }),
    lastActivityAt: timestamp("last_activity_at", { mode: "date" }).defaultNow(),
    deviceFingerprint: varchar("device_fingerprint", { length: 255 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    geoLocation: jsonb("geo_location"),
    isRevoked: boolean("is_revoked").default(false),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    revokedBy: varchar("revoked_by"),
    revokedReason: text("revoked_reason"),
    mfaVerified: boolean("mfa_verified").default(false),
    mfaVerifiedAt: timestamp("mfa_verified_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    sessionTokenIdx: index("idx_user_sessions_token").on(table.sessionToken),
    userIdIdx: index("idx_user_sessions_user_id").on(table.userId),
    expiresAtIdx: index("idx_user_sessions_expires").on(table.expiresAt),
    orgIdIdx: index("idx_user_sessions_org_id").on(table.orgId),
    isRevokedIdx: index("idx_user_sessions_revoked").on(table.isRevoked),
  })
);

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

// ============================================================================
// LOGIN EVENTS
// ============================================================================

export const loginEvents = pgTable(
  "login_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").references(() => organizations.id),
    userId: varchar("user_id").references(() => users.id),
    attemptedEmail: varchar("attempted_email", { length: 255 }),
    loginType: text("login_type").notNull(),
    outcome: text("outcome").notNull(),
    failureReason: text("failure_reason"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    geoLocation: jsonb("geo_location"),
    deviceFingerprint: varchar("device_fingerprint", { length: 255 }),
    suspiciousIndicators: text("suspicious_indicators").array(),
    riskScore: real("risk_score"),
    sessionId: varchar("session_id").references(() => userSessions.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_login_events_org_id").on(table.orgId),
    userIdIdx: index("idx_login_events_user_id").on(table.userId),
    outcomeIdx: index("idx_login_events_outcome").on(table.outcome),
    createdAtIdx: index("idx_login_events_created_at").on(table.createdAt),
    ipAddressIdx: index("idx_login_events_ip").on(table.ipAddress),
  })
);

export const insertLoginEventSchema = createInsertSchema(loginEvents).omit({
  id: true,
  createdAt: true,
});

export type LoginEvent = typeof loginEvents.$inferSelect;
export type InsertLoginEvent = z.infer<typeof insertLoginEventSchema>;

// ============================================================================
// SYNC PROTOCOL VERSION
// ============================================================================

export const syncProtocolVersion = pgTable(
  "sync_protocol_version",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    deviceId: varchar("device_id")
      .notNull()
      .references(() => devices.id),
    protocolVersion: varchar("protocol_version", { length: 20 }).notNull(),
    schemaVersion: varchar("schema_version", { length: 20 }).notNull(),
    appVersion: varchar("app_version", { length: 20 }).notNull(),
    minCompatibleVersion: varchar("min_compatible_version", { length: 20 }).notNull(),
    maxCompatibleVersion: varchar("max_compatible_version", { length: 20 }),
    syncStatus: text("sync_status").notNull().default("compatible"),
    lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
    lastSyncSuccess: boolean("last_sync_success").default(true),
    lastSyncError: text("last_sync_error"),
    registeredAt: timestamp("registered_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_sync_protocol_org_id").on(table.orgId),
    deviceIdIdx: index("idx_sync_protocol_device").on(table.deviceId),
    statusIdx: index("idx_sync_protocol_status").on(table.syncStatus),
  })
);

export const insertSyncProtocolVersionSchema = createInsertSchema(syncProtocolVersion).omit({
  id: true,
  registeredAt: true,
  updatedAt: true,
});

export type SyncProtocolVersion = typeof syncProtocolVersion.$inferSelect;
export type InsertSyncProtocolVersion = z.infer<typeof insertSyncProtocolVersionSchema>;

// ============================================================================
// STORAGE CONFIG
// ============================================================================

export const storageConfig = pgTable("storage_config", {
  id: varchar("id").primaryKey(),
  kind: varchar("kind", { length: 20 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  isDefault: boolean("is_default").default(false),
  mirror: boolean("mirror").default(false),
  cfg: jsonb("cfg").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const insertStorageConfigSchema = createInsertSchema(storageConfig).omit({
  createdAt: true,
  updatedAt: true,
});

export type StorageConfig = typeof storageConfig.$inferSelect;
export type InsertStorageConfig = z.infer<typeof insertStorageConfigSchema>;

// ============================================================================
// OPS DB STAGED
// ============================================================================

export const opsDbStaged = pgTable("ops_db_staged", {
  id: integer("id").primaryKey().default(1),
  url: text("url"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const insertOpsDbStagedSchema = createInsertSchema(opsDbStaged).omit({
  createdAt: true,
});

export type OpsDbStaged = typeof opsDbStaged.$inferSelect;
export type InsertOpsDbStaged = z.infer<typeof insertOpsDbStagedSchema>;

// ============================================================================
// BEAST MODE CONFIG
// ============================================================================

export const beastModeConfig = pgTable(
  "beast_mode_config",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    featureName: text("feature_name").notNull(),
    enabled: boolean("enabled").default(false),
    configuration: jsonb("configuration"),
    lastModifiedBy: text("last_modified_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniqueOrgFeature: unique().on(table.orgId, table.featureName),
  })
);

export const insertBeastModeConfigSchema = createInsertSchema(beastModeConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BeastModeConfig = typeof beastModeConfig.$inferSelect;
export type InsertBeastModeConfig = z.infer<typeof insertBeastModeConfigSchema>;
