/**
 * Schema Compliance - Regulatory Audit and Compliance Tracking
 *
 * Compliance audit logs, bundles, and immutable audit trails for ISM/Class compliance.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  createInsertSchema,
  z,
  uuidPrimaryKey,
  tenantColumn,
} from "./base";
import { organizations } from "./core";
import { vessels } from "./vessels";

// Compliance audit trail table for regulatory tracking - uses shared column builders
export const complianceAuditLog = pgTable("compliance_audit_log", {
  ...uuidPrimaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  performedBy: text("performed_by").notNull(),
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow(),
  details: text("details"),
  complianceStandard: text("compliance_standard"),
  regulatoryReference: text("regulatory_reference"),
});

// Compliance Bundles: Regulatory documentation packages - uses shared column builders
export const complianceBundles = pgTable("compliance_bundles", {
  ...uuidPrimaryKey(),
  ...tenantColumn(organizations),
  bundleId: text("bundle_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  generatedAt: timestamp("generated_at", { mode: "date" }).defaultNow(),
  sha256Hash: text("sha256_hash").notNull(),
  filePath: text("file_path"),
  fileFormat: text("file_format").default("html"),
  payloadData: jsonb("payload_data"),
  complianceStandards: text("compliance_standards").array(),
  validityPeriod: integer("validity_period_months"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Immutable Audit Trail with Hash Chaining for Tamper Evidence (ISM/Class Compliance) - uses shared column builders
export const immutableAuditTrail = pgTable(
  "immutable_audit_trail",
  {
    ...uuidPrimaryKey(),
    ...tenantColumn(organizations),
    eventCategory: text("event_category").notNull(),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: varchar("entity_id").notNull(),
    previousState: jsonb("previous_state"),
    newState: jsonb("new_state"),
    changedFields: text("changed_fields").array(),
    performedBy: text("performed_by").notNull(),
    performedByType: text("performed_by_type").notNull().default("user"),
    performedByName: text("performed_by_name"),
    performedByRole: text("performed_by_role"),
    ipAddress: varchar("ip_address", { length: 45 }),
    deviceId: varchar("device_id"),
    vesselId: varchar("vessel_id"),
    eventTimestamp: timestamp("event_timestamp", { mode: "date" }).notNull().defaultNow(),
    serverTimestamp: timestamp("server_timestamp", { mode: "date" }).defaultNow(),
    prevHash: varchar("prev_hash", { length: 64 }),
    hash: varchar("hash", { length: 64 }).notNull(),
    // LR-3.5 / AUD-2 (Task #208): hash function version. v1 is the
    // legacy pre-orgId hash; v2 binds `orgId` into the hashed
    // payload. The verifier dispatches on this column so historical
    // v1 rows still validate without a one-shot rehash.
    hashVersion: integer("hash_version").notNull().default(2),
    complianceStandard: text("compliance_standard"),
    retentionRequired: boolean("retention_required").default(true),
    retentionExpiresAt: timestamp("retention_expires_at", { mode: "date" }),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    orgIdIdx: index("idx_immutable_audit_org_id").on(table.orgId),
    entityIdx: index("idx_immutable_audit_entity").on(table.entityType, table.entityId),
    eventTimestampIdx: index("idx_immutable_audit_timestamp").on(table.eventTimestamp),
    hashIdx: index("idx_immutable_audit_hash").on(table.hash),
    categoryIdx: index("idx_immutable_audit_category").on(table.eventCategory, table.eventType),
    performedByIdx: index("idx_immutable_audit_performer").on(table.performedBy),
  })
);

// Compliance documents
export const complianceDocs = pgTable(
  "compliance_docs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    documentType: text("document_type").notNull(),
    title: text("title").notNull(),
    issuedAt: timestamp("issued_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    status: text("status").default("active"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_compliance_docs_org").on(table.orgId),
    vesselIdx: index("idx_compliance_docs_vessel").on(table.vesselId),
    expiresIdx: index("idx_compliance_docs_expires").on(table.expiresAt),
  })
);

// Compliance findings
export const complianceFindings = pgTable(
  "compliance_findings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    logDate: text("log_date"),
    sourceType: text("source_type").notNull(),
    ruleCode: text("rule_code").notNull(),
    ruleName: text("rule_name").notNull(),
    category: text("category").notNull(),
    severity: text("severity").notNull().default("warning"),
    message: text("message").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>(),
    linkedDeckLogDayId: varchar("linked_deck_log_day_id"),
    linkedEngineLogDayId: varchar("linked_engine_log_day_id"),
    linkedEquipmentIds: jsonb("linked_equipment_ids").$type<string[]>(),
    linkedWorkOrderIds: jsonb("linked_work_order_ids").$type<string[]>(),
    linkedCrewIds: jsonb("linked_crew_ids").$type<string[]>(),
    linkedAlertIds: jsonb("linked_alert_ids").$type<string[]>(),
    status: text("status").notNull().default("open"),
    // LR-3.5 / AUD-1 (Task #208): soft-archive columns. Compliance
    // findings are never hard-deleted — DELETE sets `archivedAt` /
    // `archivedBy` and flips `status` to 'archived'. Reads exclude
    // archived rows unless the caller passes `includeArchived=true`.
    archivedAt: timestamp("archived_at", { mode: "date" }),
    archivedBy: varchar("archived_by"),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
    acknowledgedByUserId: varchar("acknowledged_by_user_id"),
    acknowledgedByUserName: text("acknowledged_by_user_name"),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    resolvedByUserId: varchar("resolved_by_user_id"),
    resolvedByUserName: text("resolved_by_user_name"),
    resolutionNotes: text("resolution_notes"),
    suppressedUntil: timestamp("suppressed_until", { mode: "date" }),
    suppressedReason: text("suppressed_reason"),
    notificationSentAt: timestamp("notification_sent_at", { mode: "date" }),
    notificationRecipients: jsonb("notification_recipients").$type<string[]>(),
    foundAt: timestamp("found_at", { mode: "date" }).defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_compliance_findings_org").on(table.orgId),
    vesselIdIdx: index("idx_compliance_findings_vessel").on(table.vesselId),
    dateIdx: index("idx_compliance_findings_date").on(table.logDate),
    sourceIdx: index("idx_compliance_findings_source").on(table.sourceType),
    severityIdx: index("idx_compliance_findings_severity").on(table.severity),
    statusIdx: index("idx_compliance_findings_status").on(table.status),
    ruleCodeIdx: index("idx_compliance_findings_rule").on(table.ruleCode),
  })
);

// Compliance rules
export const complianceRules = pgTable(
  "compliance_rules",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    ruleCode: text("rule_code").notNull(),
    ruleName: text("rule_name").notNull(),
    description: text("description"),
    sourceType: text("source_type").notNull(),
    category: text("category").notNull(),
    severity: text("severity").notNull().default("warning"),
    ruleType: text("rule_type").notNull(),
    ruleConfig: jsonb("rule_config").$type<Record<string, unknown>>(),
    notifyOnTrigger: boolean("notify_on_trigger").default(true),
    notifyRoles: jsonb("notify_roles").$type<string[]>(),
    notifyEmails: jsonb("notify_emails").$type<string[]>(),
    enabled: boolean("enabled").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_compliance_rules_org").on(table.orgId),
    ruleCodeIdx: index("idx_compliance_rules_code").on(table.ruleCode),
    sourceIdx: index("idx_compliance_rules_source").on(table.sourceType),
    enabledIdx: index("idx_compliance_rules_enabled").on(table.enabled),
  })
);

// Insert schemas
export const insertComplianceAuditLogSchema = createInsertSchema(complianceAuditLog).omit({
  id: true,
  timestamp: true,
});

export const insertComplianceBundleSchema = createInsertSchema(complianceBundles).omit({
  id: true,
  createdAt: true,
});

export const insertImmutableAuditTrailSchema = createInsertSchema(immutableAuditTrail).omit({
  id: true,
  serverTimestamp: true,
});

export const insertComplianceDocSchema = createInsertSchema(complianceDocs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceFindingSchema = createInsertSchema(complianceFindings).omit({
  id: true,
  foundAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceRuleSchema = createInsertSchema(complianceRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type ComplianceAuditLog = typeof complianceAuditLog.$inferSelect;
export type InsertComplianceAuditLog = z.infer<typeof insertComplianceAuditLogSchema>;
export type ComplianceBundle = typeof complianceBundles.$inferSelect;
export type InsertComplianceBundle = z.infer<typeof insertComplianceBundleSchema>;
export type ImmutableAuditTrail = typeof immutableAuditTrail.$inferSelect;
export type InsertImmutableAuditTrail = z.infer<typeof insertImmutableAuditTrailSchema>;
export type ComplianceDoc = typeof complianceDocs.$inferSelect;
export type InsertComplianceDoc = z.infer<typeof insertComplianceDocSchema>;
export type ComplianceFinding = typeof complianceFindings.$inferSelect;
export type InsertComplianceFinding = z.infer<typeof insertComplianceFindingSchema>;
export type ComplianceRule = typeof complianceRules.$inferSelect;
export type InsertComplianceRule = z.infer<typeof insertComplianceRuleSchema>;
