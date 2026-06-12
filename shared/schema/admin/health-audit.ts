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
} from "../base";
import { organizations, users } from "../core";

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
    // Deliberately string-mode: numeric(20,0) sequence numbers exceed
    // Number.MAX_SAFE_INTEGER; consumers compare/parse as strings.
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
