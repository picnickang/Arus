/**
 * SQLite Schema Alerts Module
 * Alert configurations, notifications, suppressions, comments
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const alertConfigurationsSqlite = sqliteTable(
  "alert_configurations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id"),
    vesselId: text("vessel_id"),
    alertType: text("alert_type").notNull(),
    sensorType: text("sensor_type"),
    condition: text("condition").notNull(),
    threshold: real("threshold"),
    severity: text("severity").notNull().default("warning"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).default(true),
    cooldownMinutes: integer("cooldown_minutes").default(60),
    notificationChannels: text("notification_channels"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_ac_org").on(table.orgId),
    equipmentIdx: index("idx_ac_equipment").on(table.equipmentId),
    alertTypeIdx: index("idx_ac_alert_type").on(table.alertType),
  })
);

export const alertNotificationsSqlite = sqliteTable(
  "alert_notifications",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    alertConfigId: text("alert_config_id"),
    equipmentId: text("equipment_id"),
    vesselId: text("vessel_id"),
    alertType: text("alert_type").notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    message: text("message"),
    sensorValue: real("sensor_value"),
    threshold: real("threshold"),
    isAcknowledged: integer("is_acknowledged", { mode: "boolean" }).default(false),
    acknowledgedBy: text("acknowledged_by"),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_an_org").on(table.orgId),
    equipmentIdx: index("idx_an_equipment").on(table.equipmentId),
    createdAtIdx: index("idx_an_created_at").on(table.createdAt),
    acknowledgedIdx: index("idx_an_acknowledged").on(table.isAcknowledged),
  })
);

export const alertSuppressionsSqlite = sqliteTable(
  "alert_suppressions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    alertConfigId: text("alert_config_id"),
    equipmentId: text("equipment_id"),
    alertType: text("alert_type"),
    suppressionType: text("suppression_type").notNull(),
    reason: text("reason"),
    startTime: integer("start_time", { mode: "timestamp" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp" }),
    createdBy: text("created_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    alertConfigIdx: index("idx_as_alert_config").on(table.alertConfigId),
    timeIdx: index("idx_as_time").on(table.startTime, table.endTime),
  })
);

export const alertCommentsSqlite = sqliteTable(
  "alert_comments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    alertNotificationId: text("alert_notification_id").notNull(),
    comment: text("comment").notNull(),
    createdBy: text("created_by"),
    createdByName: text("created_by_name"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    alertIdx: index("idx_acom_alert").on(table.alertNotificationId),
  })
);

export const actionableInsightsSqlite = sqliteTable(
  "actionable_insights",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id"),
    vesselId: text("vessel_id"),
    insightType: text("insight_type").notNull(),
    severity: text("severity").notNull().default("info"),
    title: text("title").notNull(),
    description: text("description"),
    recommendation: text("recommendation"),
    potentialSavings: real("potential_savings"),
    confidenceScore: real("confidence_score"),
    status: text("status").notNull().default("new"),
    acknowledgedBy: text("acknowledged_by"),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_ai_org").on(table.orgId),
    equipmentIdx: index("idx_ai_equipment").on(table.equipmentId),
    statusIdx: index("idx_ai_status").on(table.status),
  })
);

export const operatingConditionAlertsSqlite = sqliteTable(
  "operating_condition_alerts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    conditionType: text("condition_type").notNull(),
    severity: text("severity").notNull(),
    description: text("description"),
    currentValue: real("current_value"),
    expectedRange: text("expected_range"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    acknowledgedBy: text("acknowledged_by"),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_oca_equipment").on(table.equipmentId),
    activeIdx: index("idx_oca_active").on(table.isActive),
  })
);

export const pdmAlertsSqlite = sqliteTable(
  "pdm_alerts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    alertType: text("alert_type").notNull(),
    severity: text("severity").notNull(),
    pdmScore: real("pdm_score"),
    rulDays: real("rul_days"),
    confidence: real("confidence"),
    description: text("description"),
    recommendation: text("recommendation"),
    status: text("status").notNull().default("new"),
    acknowledgedBy: text("acknowledged_by"),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_pdma_equipment").on(table.equipmentId),
    statusIdx: index("idx_pdma_status").on(table.status),
  })
);
