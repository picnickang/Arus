/**
 * Alert settings schema tables.
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
} from "../base";
import { organizations } from "../core";
import { vessels } from "../vessels";

// Alert settings - organization-level alert configuration
// Real DB shape: SMTP / email-provider / digest / test-status columns.
// The previous "machineryAlertsEnabled / adminEmail / useVesselSpecificSettings"
// columns never existed in the database.
export const alertSettings = pgTable(
  "alert_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    emailEnabled: boolean("email_enabled").default(true),
    defaultToEmail: text("default_to_email"),
    ccEmails: jsonb("cc_emails").$type<string[]>(),
    bccEmails: jsonb("bcc_emails").$type<string[]>(),
    timezone: text("timezone").default("Asia/Singapore"),
    provider: text("provider").default("sendgrid"),
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port").default(587),
    smtpUser: text("smtp_user"),
    smtpEncryptedPassword: text("smtp_encrypted_password"),
    smtpUseTls: boolean("smtp_use_tls").default(true),
    apiKeyEncrypted: text("api_key_encrypted"),
    apiBaseUrl: text("api_base_url"),
    fromEmail: text("from_email").default("noreply@arus-marine.com"),
    fromName: text("from_name").default("ARUS Marine"),
    alertCooldownMinutes: integer("alert_cooldown_minutes").default(30),
    dailyDigestEnabled: boolean("daily_digest_enabled").default(false),
    dailyDigestTime: text("daily_digest_time").default("08:00"),
    lastTestStatus: text("last_test_status"),
    lastTestAt: timestamp("last_test_at", { mode: "date" }),
    lastTestError: text("last_test_error"),
    purchaseOrderEmailTemplate: jsonb("purchase_order_email_template").$type<{
      subject: string;
      body: string;
      enabled: boolean;
    }>(),
    serviceOrderEmailTemplate: jsonb("service_order_email_template").$type<{
      subject: string;
      body: string;
      enabled: boolean;
    }>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_alert_settings_org").on(table.orgId),
    uniqueOrg: unique("uq_alert_settings_org").on(table.orgId),
  })
);

// Alert settings per vessel
// Real DB: critical/warning/info booleans + override/additional emails + threshold overrides.
// Previous "machineryAlertsEnabled / recipientEmails / cooldownMinutes" columns
// never existed in the database.
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
    criticalAlertsEnabled: boolean("critical_alerts_enabled").default(true),
    warningAlertsEnabled: boolean("warning_alerts_enabled").default(true),
    infoAlertsEnabled: boolean("info_alerts_enabled").default(false),
    overrideEmails: jsonb("override_emails").$type<string[]>(),
    additionalEmails: jsonb("additional_emails").$type<string[]>(),
    thresholdOverrides: jsonb("threshold_overrides").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_alert_settings_vessel_org").on(table.orgId),
    vesselIdIdx: index("idx_alert_settings_vessel_vessel").on(table.vesselId),
    uniqueOrgVessel: unique("uq_alert_settings_vessel").on(table.orgId, table.vesselId),
  })
);

// Alert thresholds
export const alertThresholdCategoryEnum = [
  "machinery",
  "telemetry",
  "compliance",
  "crew",
  "logbook",
  "maintenance",
] as const;
export type AlertThresholdCategory = (typeof alertThresholdCategoryEnum)[number];

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
    uniqueCooldown: unique("uq_alert_cooldown").on(
      table.orgId,
      table.vesselId,
      table.alertType,
      table.alertKey,
      table.entityId
    ),
  })
);

// Insert schemas
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
