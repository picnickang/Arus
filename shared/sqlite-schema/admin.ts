/**
 * SQLite Schema Admin Module
 * System settings, audit events, integrations, error logs, sessions
 */

import { sqliteTable, text, integer, index } from "./base";

export const adminSystemSettingsSqlite = sqliteTable(
  "admin_system_settings",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().default("default-org-id"),
    category: text("category").notNull().default("general"),
    key: text("key").notNull(),
    value: text("value"),
    dataType: text("data_type").notNull().default("string"),
    description: text("description"),
    isSecret: integer("is_secret", { mode: "boolean" }).default(false),
    isReadonly: integer("is_readonly", { mode: "boolean" }).default(false),
    validationRule: text("validation_rule"),
    defaultValue: text("default_value"),
    updatedBy: text("updated_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgCategoryKeyIdx: index("idx_ass_org_category_key").on(table.orgId, table.category, table.key),
  })
);

export const adminAuditEventsSqlite = sqliteTable(
  "admin_audit_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    eventType: text("event_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    performedBy: text("performed_by"),
    performedByName: text("performed_by_name"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    details: text("details"),
    status: text("status").notNull().default("success"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_aae_org").on(table.orgId),
    eventTypeIdx: index("idx_aae_event_type").on(table.eventType),
    createdAtIdx: index("idx_aae_created_at").on(table.createdAt),
  })
);

export const integrationConfigsSqlite = sqliteTable(
  "integration_configs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    integrationType: text("integration_type").notNull(),
    name: text("name").notNull(),
    configuration: text("configuration"),
    credentials: text("credentials"),
    status: text("status").notNull().default("inactive"),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
    lastSyncStatus: text("last_sync_status"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgTypeIdx: index("idx_ic_org_type").on(table.orgId, table.integrationType),
  })
);

export const errorLogsSqlite = sqliteTable(
  "error_logs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id"),
    errorType: text("error_type").notNull(),
    errorCode: text("error_code"),
    message: text("message").notNull(),
    stackTrace: text("stack_trace"),
    context: text("context"),
    userId: text("user_id"),
    requestId: text("request_id"),
    endpoint: text("endpoint"),
    severity: text("severity").notNull().default("error"),
    resolved: integer("resolved", { mode: "boolean" }).default(false),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolvedBy: text("resolved_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    severityIdx: index("idx_el_severity").on(table.severity),
    createdAtIdx: index("idx_el_created_at").on(table.createdAt),
    resolvedIdx: index("idx_el_resolved").on(table.resolved),
  })
);

export const opsDbStagedSqlite = sqliteTable(
  "ops_db_staged",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    operationType: text("operation_type").notNull(),
    tableName: text("table_name").notNull(),
    recordId: text("record_id"),
    data: text("data"),
    status: text("status").notNull().default("pending"),
    processedAt: integer("processed_at", { mode: "timestamp" }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    statusIdx: index("idx_ods_status").on(table.status),
    tableNameIdx: index("idx_ods_table_name").on(table.tableName),
  })
);

export const userSessionsSqlite = sqliteTable(
  "user_sessions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    sessionToken: text("session_token").notNull(),
    deviceInfo: text("device_info"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    userIdx: index("idx_us_user").on(table.userId),
    tokenIdx: index("idx_us_token").on(table.sessionToken),
    activeIdx: index("idx_us_active").on(table.isActive),
  })
);

export const loginEventsSqlite = sqliteTable(
  "login_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id"),
    eventType: text("event_type").notNull(),
    success: integer("success", { mode: "boolean" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    failureReason: text("failure_reason"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    userIdx: index("idx_le_user").on(table.userId),
    eventTypeIdx: index("idx_le_event_type").on(table.eventType),
    createdAtIdx: index("idx_le_created_at").on(table.createdAt),
  })
);

export const dataSubjectRequestsSqlite = sqliteTable(
  "data_subject_requests",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    requestType: text("request_type").notNull(),
    subjectId: text("subject_id").notNull(),
    subjectEmail: text("subject_email"),
    status: text("status").notNull().default("pending"),
    requestDetails: text("request_details"),
    processedBy: text("processed_by"),
    processedAt: integer("processed_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    statusIdx: index("idx_dsr_status").on(table.status),
    subjectIdx: index("idx_dsr_subject").on(table.subjectId),
  })
);

export const crossBorderTransfersSqlite = sqliteTable(
  "cross_border_transfers",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dataType: text("data_type").notNull(),
    sourceCountry: text("source_country").notNull(),
    destinationCountry: text("destination_country").notNull(),
    legalBasis: text("legal_basis"),
    safeguards: text("safeguards"),
    transferDate: integer("transfer_date", { mode: "timestamp" }),
    recordCount: integer("record_count"),
    status: text("status").notNull().default("completed"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_cbt_org").on(table.orgId),
    transferDateIdx: index("idx_cbt_transfer_date").on(table.transferDate),
  })
);
