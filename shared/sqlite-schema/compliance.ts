/**
 * SQLite Schema Compliance Module
 * Audit logs, compliance bundles, documents, immutable audit trail
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const complianceAuditLogSqlite = sqliteTable(
  "compliance_audit_log",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    performedBy: text("performed_by"),
    performedByName: text("performed_by_name"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    entityIdx: index("idx_cal_entity").on(table.entityType, table.entityId),
    createdAtIdx: index("idx_cal_created_at").on(table.createdAt),
  })
);

export const complianceBundlesSqlite = sqliteTable(
  "compliance_bundles",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    bundleType: text("bundle_type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    vesselId: text("vessel_id"),
    startDate: integer("start_date", { mode: "timestamp" }),
    endDate: integer("end_date", { mode: "timestamp" }),
    status: text("status").notNull().default("draft"),
    documentIds: text("document_ids"),
    generatedBy: text("generated_by"),
    generatedAt: integer("generated_at", { mode: "timestamp" }),
    fileUrl: text("file_url"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_cb_org").on(table.orgId),
    typeIdx: index("idx_cb_type").on(table.bundleType),
  })
);

export const complianceDocsSqlite = sqliteTable(
  "compliance_docs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    documentType: text("document_type").notNull(),
    title: text("title").notNull(),
    vesselId: text("vessel_id"),
    equipmentId: text("equipment_id"),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    status: text("status").notNull().default("active"),
    expiryDate: integer("expiry_date", { mode: "timestamp" }),
    uploadedBy: text("uploaded_by"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_cdocs_org").on(table.orgId),
    typeIdx: index("idx_cdocs_type").on(table.documentType),
    vesselIdx: index("idx_cdocs_vessel").on(table.vesselId),
  })
);

export const arMaintenanceProceduresSqlite = sqliteTable(
  "ar_maintenance_procedures",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentType: text("equipment_type").notNull(),
    procedureName: text("procedure_name").notNull(),
    description: text("description"),
    arModelUrl: text("ar_model_url"),
    steps: text("steps"),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    requiredTools: text("required_tools"),
    safetyWarnings: text("safety_warnings"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentTypeIdx: index("idx_amp_equipment_type").on(table.equipmentType),
  })
);

export const immutableAuditTrailSqlite = sqliteTable(
  "immutable_audit_trail",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    eventCategory: text("event_category"),
    eventType: text("event_type"),
    sequenceNumber: integer("sequence_number").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    previousState: text("previous_state"),
    newState: text("new_state"),
    changedFields: text("changed_fields"),
    dataHash: text("data_hash").notNull(),
    hash: text("hash"),
    previousHash: text("previous_hash"),
    prevHash: text("prev_hash"),
    data: text("data"),
    dataBefore: text("data_before"),
    dataAfter: text("data_after"),
    performedBy: text("performed_by"),
    performedByType: text("performed_by_type"),
    performedByName: text("performed_by_name"),
    performedByRole: text("performed_by_role"),
    actor: text("actor"),
    actorRole: text("actor_role"),
    ipAddress: text("ip_address"),
    deviceId: text("device_id"),
    vesselId: text("vessel_id"),
    eventTimestamp: integer("event_timestamp", { mode: "timestamp" }),
    serverTimestamp: integer("server_timestamp", { mode: "timestamp" }),
    performedAt: integer("performed_at", { mode: "timestamp" }).notNull(),
    hashVersion: integer("hash_version").notNull().default(2),
    complianceStandard: text("compliance_standard"),
    retentionRequired: integer("retention_required", { mode: "boolean" }).default(true),
    retentionExpiresAt: integer("retention_expires_at", { mode: "timestamp" }),
    signature: text("signature"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    sequenceIdx: index("idx_iat_sequence").on(table.sequenceNumber),
    entityIdx: index("idx_iat_entity").on(table.entityType, table.entityId),
    hashIdx: index("idx_iat_hash").on(table.dataHash),
    eventTimestampIdx: index("idx_iat_event_timestamp").on(table.eventTimestamp),
  })
);

export const engineerOverridesSqlite = sqliteTable(
  "engineer_overrides",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    overrideType: text("override_type").notNull(),
    originalValue: text("original_value"),
    overrideValue: text("override_value"),
    reason: text("reason"),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    targetIdx: index("idx_eo_target").on(table.targetType, table.targetId),
    statusIdx: index("idx_eo_status").on(table.status),
  })
);

export const predictionDataQualitySqlite = sqliteTable(
  "prediction_data_quality",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    predictionId: text("prediction_id").notNull(),
    dataFreshness: text("data_freshness"),
    sensorCoverage: real("sensor_coverage"),
    anomalyRate: real("anomaly_rate"),
    overallQualityScore: real("overall_quality_score"),
    issues: text("issues"),
    assessedAt: integer("assessed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    predictionIdx: index("idx_pdq_prediction").on(table.predictionId),
  })
);
