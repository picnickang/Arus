/**
 * Schema Alerts - Alert Configurations and Notifications
 * 
 * Alert settings, notifications, suppressions, and cooldowns.
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
  index,
  unique,
  createInsertSchema,
  z,
} from "./base.js";
import { organizations } from "./core.js";
import { equipment } from "./equipment.js";
import { workOrders } from "./work-orders.js";
import { vessels } from "./vessels.js";

// Alert configurations
export const alertConfigurations = pgTable(
  "alert_configurations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id),
    sensorType: text("sensor_type").notNull(),
    warningThreshold: real("warning_threshold"),
    criticalThreshold: real("critical_threshold"),
    enabled: boolean("enabled").default(true),
    notifyEmail: boolean("notify_email").default(false),
    notifyInApp: boolean("notify_in_app").default(true),
    version: integer("version").default(1),
    lastModifiedBy: varchar("last_modified_by", { length: 255 }),
    lastModifiedDevice: varchar("last_modified_device", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniqueEquipmentSensor: sql`ALTER TABLE ${table} ADD CONSTRAINT unique_equipment_sensor UNIQUE (${table.equipmentId}, ${table.sensorType})`,
  })
);

// Alert notifications
export const alertNotifications = pgTable("alert_notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  equipmentId: varchar("equipment_id")
    .notNull()
    .references(() => equipment.id),
  sensorType: text("sensor_type").notNull(),
  alertType: text("alert_type").notNull(),
  message: text("message").notNull(),
  value: real("value").notNull(),
  threshold: real("threshold").notNull(),
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
  acknowledgedBy: text("acknowledged_by"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Alert suppressions
export const alertSuppressions = pgTable(
  "alert_suppressions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentId: varchar("equipment_id").references(() => equipment.id),
    sensorType: text("sensor_type"),
    reason: text("reason").notNull(),
    suppressedBy: text("suppressed_by").notNull(),
    suppressUntil: timestamp("suppress_until", { mode: "date" }).notNull(),
    active: boolean("active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_alert_suppressions_org_id").on(table.orgId),
  })
);

// Alert comments
export const alertComments = pgTable(
  "alert_comments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    alertId: text("alert_id").notNull(),
    comment: text("comment").notNull(),
    commentedBy: text("commented_by").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_alert_comments_org_id").on(table.orgId),
  })
);

// Actionable insights
export const actionableInsights = pgTable(
  "actionable_insights",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    type: varchar("type", { length: 100 }).notNull(),
    severity: varchar("severity", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    supportingSignals: jsonb("supporting_signals"),
    recommendedAction: jsonb("recommended_action"),
    relatedProcedures: jsonb("related_procedures"),
    acknowledged: boolean("acknowledged").default(false),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
    acknowledgedBy: varchar("acknowledged_by", { length: 255 }),
    resolved: boolean("resolved").default(false),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    resolvedBy: varchar("resolved_by", { length: 255 }),
    resolutionNotes: text("resolution_notes"),
    workOrderId: varchar("work_order_id").references(() => workOrders.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_actionable_insights_org_id").on(table.orgId),
    equipmentIdIdx: index("idx_actionable_insights_equipment_id").on(table.equipmentId),
    severityIdx: index("idx_actionable_insights_severity").on(table.severity),
    statusIdx: index("idx_actionable_insights_status").on(table.acknowledged, table.resolved),
    typeIdx: index("idx_actionable_insights_type").on(table.type),
  })
);

// Alert settings - organization-level alert configuration
export const alertSettings = pgTable(
  "alert_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    enabled: boolean("enabled").default(true),
    adminEmail: text("admin_email"),
    technicalEmail: text("technical_email"),
    operationsEmail: text("operations_email"),
    machineryAlertsEnabled: boolean("machinery_alerts_enabled").default(true),
    telemetryAlertsEnabled: boolean("telemetry_alerts_enabled").default(true),
    complianceAlertsEnabled: boolean("compliance_alerts_enabled").default(true),
    crewAlertsEnabled: boolean("crew_alerts_enabled").default(true),
    logbookAlertsEnabled: boolean("logbook_alerts_enabled").default(true),
    maintenanceAlertsEnabled: boolean("maintenance_alerts_enabled").default(true),
    defaultCooldownMinutes: integer("default_cooldown_minutes").default(60),
    useVesselSpecificSettings: boolean("use_vessel_specific_settings").default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_alert_settings_org").on(table.orgId),
    uniqueOrg: unique("uq_alert_settings_org").on(table.orgId),
  })
);

// Alert settings per vessel
export const alertSettingsVessel = pgTable(
  "alert_settings_vessel",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id),
    enabled: boolean("enabled").default(true),
    recipientEmails: jsonb("recipient_emails").$type<string[]>(),
    machineryAlertsEnabled: boolean("machinery_alerts_enabled"),
    telemetryAlertsEnabled: boolean("telemetry_alerts_enabled"),
    complianceAlertsEnabled: boolean("compliance_alerts_enabled"),
    crewAlertsEnabled: boolean("crew_alerts_enabled"),
    logbookAlertsEnabled: boolean("logbook_alerts_enabled"),
    maintenanceAlertsEnabled: boolean("maintenance_alerts_enabled"),
    cooldownMinutes: integer("cooldown_minutes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_alert_settings_vessel_org").on(table.orgId),
    vesselIdIdx: index("idx_alert_settings_vessel_vessel").on(table.vesselId),
    uniqueOrgVessel: unique("uq_alert_settings_vessel_org_vessel").on(table.orgId, table.vesselId),
  })
);

// Alert thresholds
export const alertThresholdCategoryEnum = ["machinery", "telemetry", "compliance", "crew", "logbook", "maintenance"] as const;
export type AlertThresholdCategory = typeof alertThresholdCategoryEnum[number];

export const alertThresholds = pgTable(
  "alert_thresholds",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    category: text("category").notNull(),
    key: text("key").notNull(),
    severity: text("severity").default("warning"),
    enabled: boolean("enabled").default(true),
    thresholdValue: real("threshold_value"),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    thresholdUnit: text("threshold_unit"),
    name: text("name").notNull(),
    description: text("description"),
    sendEmail: boolean("send_email").default(true),
    cooldownMinutes: integer("cooldown_minutes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_alert_thresholds_org").on(table.orgId),
    categoryIdx: index("idx_alert_thresholds_category").on(table.category),
    keyIdx: index("idx_alert_thresholds_key").on(table.key),
    uniqueOrgKey: unique("uq_alert_thresholds_org_key").on(table.orgId, table.key),
  })
);

// Alert email log
export const alertEmailLog = pgTable(
  "alert_email_log",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    alertType: text("alert_type").notNull(),
    alertKey: text("alert_key"),
    severity: text("severity").notNull(),
    recipients: jsonb("recipients").$type<string[]>().notNull(),
    ccRecipients: jsonb("cc_recipients").$type<string[]>(),
    bccRecipients: jsonb("bcc_recipients").$type<string[]>(),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("pending"),
    messageId: text("message_id"),
    errorMessage: text("error_message"),
    payloadPreview: jsonb("payload_preview").$type<Record<string, unknown>>(),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: varchar("related_entity_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    sentAt: timestamp("sent_at", { mode: "date" }),
  },
  (table) => ({
    orgIdIdx: index("idx_alert_email_log_org").on(table.orgId),
    vesselIdIdx: index("idx_alert_email_log_vessel").on(table.vesselId),
    statusIdx: index("idx_alert_email_log_status").on(table.status),
    alertTypeIdx: index("idx_alert_email_log_type").on(table.alertType),
    createdAtIdx: index("idx_alert_email_log_created").on(table.createdAt),
  })
);

// Crew alert settings
export const crewAlertSettings = pgTable(
  "crew_alert_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    certExpiryAlertsEnabled: boolean("cert_expiry_alerts_enabled").default(true),
    certExpiryDays30: boolean("cert_expiry_days_30").default(true),
    certExpiryDays60: boolean("cert_expiry_days_60").default(true),
    certExpiryDays90: boolean("cert_expiry_days_90").default(true),
    certExpiryCustomDays: integer("cert_expiry_custom_days"),
    horViolationAlertsEnabled: boolean("hor_violation_alerts_enabled").default(true),
    horViolationMinSeverity: text("hor_violation_min_severity").default("warning"),
    horViolationNotifyMaster: boolean("hor_violation_notify_master").default(true),
    horViolationNotifyDpa: boolean("hor_violation_notify_dpa").default(true),
    missingSignatureAlertsEnabled: boolean("missing_signature_alerts_enabled").default(true),
    signatureReminderHours: integer("signature_reminder_hours").default(24),
    manningAlertsEnabled: boolean("manning_alerts_enabled").default(true),
    manningMinimumWatch: integer("manning_minimum_watch"),
    crewChangeRemindersEnabled: boolean("crew_change_reminders_enabled").default(true),
    crewChangeReminderDays: integer("crew_change_reminder_days").default(14),
    dpaEmail: text("dpa_email"),
    crewingManagerEmail: text("crewing_manager_email"),
    hseEmail: text("hse_email"),
    additionalRecipients: jsonb("additional_recipients").$type<string[]>(),
    sendToAdminEmail: boolean("send_to_admin_email").default(false),
    cooldownMinutes: integer("cooldown_minutes").default(60),
    dailyDigestEnabled: boolean("daily_digest_enabled").default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_crew_alert_settings_org").on(table.orgId),
    vesselIdIdx: index("idx_crew_alert_settings_vessel").on(table.vesselId),
    uniqueOrgVessel: unique("uq_crew_alert_settings_org_vessel").on(table.orgId, table.vesselId),
  })
);

// Alert cooldown
export const alertCooldown = pgTable(
  "alert_cooldown",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    alertType: text("alert_type").notNull(),
    alertKey: text("alert_key").notNull(),
    entityId: varchar("entity_id"),
    lastAlertAt: timestamp("last_alert_at", { mode: "date" }).notNull(),
    lastEmailAt: timestamp("last_email_at", { mode: "date" }),
    alertCount: integer("alert_count").default(1),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_alert_cooldown_org").on(table.orgId),
    vesselIdIdx: index("idx_alert_cooldown_vessel").on(table.vesselId),
    alertTypeKeyIdx: index("idx_alert_cooldown_type_key").on(table.alertType, table.alertKey),
    uniqueCooldown: unique("uq_alert_cooldown").on(table.orgId, table.vesselId, table.alertType, table.alertKey, table.entityId),
  })
);

// Insert schemas
export const insertAlertConfigSchema = createInsertSchema(alertConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertNotificationSchema = createInsertSchema(alertNotifications).omit({
  id: true,
  createdAt: true,
});

export const insertAlertSuppressionSchema = createInsertSchema(alertSuppressions)
  .omit({ id: true, createdAt: true })
  .extend({
    suppressUntil: z.coerce.date(),
  });

export const insertAlertCommentSchema = createInsertSchema(alertComments).omit({
  id: true,
  createdAt: true,
});

export const insertActionableInsightSchema = createInsertSchema(actionableInsights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertSettingsSchema = createInsertSchema(alertSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertSettingsVesselSchema = createInsertSchema(alertSettingsVessel).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertThresholdSchema = createInsertSchema(alertThresholds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertEmailLogSchema = createInsertSchema(alertEmailLog).omit({
  id: true,
  createdAt: true,
});

export const insertCrewAlertSettingsSchema = createInsertSchema(crewAlertSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertCooldownSchema = createInsertSchema(alertCooldown).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type AlertConfiguration = typeof alertConfigurations.$inferSelect;
export type InsertAlertConfiguration = z.infer<typeof insertAlertConfigSchema>;
export type AlertNotification = typeof alertNotifications.$inferSelect;
export type InsertAlertNotification = z.infer<typeof insertAlertNotificationSchema>;
export type AlertSuppression = typeof alertSuppressions.$inferSelect;
export type InsertAlertSuppression = z.infer<typeof insertAlertSuppressionSchema>;
export type AlertComment = typeof alertComments.$inferSelect;
export type InsertAlertComment = z.infer<typeof insertAlertCommentSchema>;
export type ActionableInsight = typeof actionableInsights.$inferSelect;
export type InsertActionableInsight = z.infer<typeof insertActionableInsightSchema>;
export type AlertSettings = typeof alertSettings.$inferSelect;
export type InsertAlertSettings = z.infer<typeof insertAlertSettingsSchema>;
export type AlertSettingsVessel = typeof alertSettingsVessel.$inferSelect;
export type InsertAlertSettingsVessel = z.infer<typeof insertAlertSettingsVesselSchema>;
export type AlertThreshold = typeof alertThresholds.$inferSelect;
export type InsertAlertThreshold = z.infer<typeof insertAlertThresholdSchema>;
export type AlertEmailLog = typeof alertEmailLog.$inferSelect;
export type InsertAlertEmailLog = z.infer<typeof insertAlertEmailLogSchema>;
export type CrewAlertSettings = typeof crewAlertSettings.$inferSelect;
export type InsertCrewAlertSettings = z.infer<typeof insertCrewAlertSettingsSchema>;
export type AlertCooldown = typeof alertCooldown.$inferSelect;
export type InsertAlertCooldown = z.infer<typeof insertAlertCooldownSchema>;
