/**
 * Schema Core - Organizations, Users, and System Settings
 * 
 * These are the foundational tables referenced by most other modules.
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
  serial,
  index,
  createInsertSchema,
  z,
} from "./base";

// Organizations for multi-tenancy
export const organizations = pgTable("organizations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"),
  billingEmail: text("billing_email"),
  maxUsers: integer("max_users").default(50),
  maxEquipment: integer("max_equipment").default(1000),
  subscriptionTier: text("subscription_tier").notNull().default("basic"),
  isActive: boolean("is_active").default(true),
  emergencyLaborMultiplier: real("emergency_labor_multiplier").default(3),
  emergencyPartsMultiplier: real("emergency_parts_multiplier").default(1.5),
  emergencyDowntimeMultiplier: real("emergency_downtime_multiplier").default(3),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Users with RBAC scaffolding and authentication
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  email: text("email").notNull(),
  username: text("username"),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires", { mode: "date" }),
  passwordUpdatedAt: timestamp("password_updated_at", { mode: "date" }),
  role: text("role").notNull().default("viewer"),
  jobTitle: text("job_title"),
  phone: text("phone"),
  timezone: text("timezone").default("UTC"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// System settings
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default("system"),
  hmacRequired: boolean("hmac_required").default(false),
  maxPayloadBytes: integer("max_payload_bytes").default(2097152),
  strictUnits: boolean("strict_units").default(false),
  llmEnabled: boolean("llm_enabled").default(true),
  llmModel: text("llm_model").default("gpt-4o-mini"),
  openaiApiKey: text("openai_api_key"),
  aiInsightsThrottleMinutes: integer("ai_insights_throttle_minutes").default(2),
  timestampToleranceMinutes: integer("timestamp_tolerance_minutes").default(5),
});

// Email settings for notifications (SMTP/SendGrid configuration)
export const emailSettings = pgTable("email_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  provider: text("provider").notNull().default("smtp"),
  isEnabled: boolean("is_enabled").default(false),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").default(587),
  smtpSecure: boolean("smtp_secure").default(false),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"),
  sendgridApiKey: text("sendgrid_api_key"),
  senderEmail: text("sender_email"),
  senderName: text("sender_name"),
  replyToEmail: text("reply_to_email"),
  maxEmailsPerHour: integer("max_emails_per_hour").default(100),
  lastTestAt: timestamp("last_test_at", { mode: "date" }),
  lastTestStatus: text("last_test_status"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const EMAIL_PROVIDERS = {
  SMTP: "smtp",
  SENDGRID: "sendgrid",
  GMAIL: "gmail",
  OUTLOOK: "outlook",
} as const;

export type EmailProvider = typeof EMAIL_PROVIDERS[keyof typeof EMAIL_PROVIDERS];

export const SMTP_PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: "smtp.gmail.com", port: 587, secure: false },
  outlook: { host: "smtp.office365.com", port: 587, secure: false },
  sendgrid: { host: "smtp.sendgrid.net", port: 587, secure: false },
};

// Metrics history for dashboard tracking
export const metricsHistory = pgTable(
  "metrics_history",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    recordedAt: timestamp("recorded_at", { mode: "date" }).notNull().defaultNow(),
    activeDevices: integer("active_devices").notNull().default(0),
    fleetHealth: real("fleet_health").notNull().default(0),
    openWorkOrders: integer("open_work_orders").notNull().default(0),
    riskAlerts: integer("risk_alerts").notNull().default(0),
    totalEquipment: integer("total_equipment").notNull().default(0),
    healthyEquipment: integer("healthy_equipment").notNull().default(0),
    warningEquipment: integer("warning_equipment").notNull().default(0),
    criticalEquipment: integer("critical_equipment").notNull().default(0),
  },
  (table) => ({
    orgTimeIdx: index("idx_metrics_history_org_time").on(table.orgId, table.recordedAt),
  })
);

// Database schema version tracking
export const dbSchemaVersion = pgTable("db_schema_version", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  appliedAt: timestamp("applied_at", { mode: "date" }).defaultNow(),
});

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    subscriptionTier: z.enum(["basic", "pro", "enterprise"]).default("basic"),
    slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
    name: z.string().min(2).max(100),
    maxUsers: z.number().min(1).max(10000).default(50),
    maxEquipment: z.number().min(1).max(100000).default(1000),
  });

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, updatedAt: true, lastLoginAt: true, passwordHash: true, passwordResetToken: true, passwordResetExpires: true, passwordUpdatedAt: true })
  .extend({
    role: z.enum(["admin", "manager", "technician", "viewer"]).default("viewer"),
    email: z.string().email(),
    name: z.string().min(2).max(100),
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional().nullable(),
    password: z.string().min(8).max(100).optional(),
    jobTitle: z.string().max(100).optional().nullable(),
    phone: z.string().max(30).optional().nullable(),
    timezone: z.string().max(50).default("UTC"),
  });

export const updateUserSchema = insertUserSchema.partial().extend({
  id: z.string().uuid(),
});

export const setPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8).max(100),
});

export const insertSettingsSchema = createInsertSchema(systemSettings).omit({ id: true });

export const insertEmailSettingsSchema = createInsertSchema(emailSettings)
  .omit({ id: true, createdAt: true, updatedAt: true, lastTestAt: true, lastTestStatus: true })
  .extend({
    provider: z.enum(["smtp", "sendgrid", "gmail", "outlook"]).default("smtp"),
    smtpPort: z.number().min(1).max(65535).default(587),
    senderEmail: z.string().email().optional().nullable(),
    replyToEmail: z.string().email().optional().nullable(),
    maxEmailsPerHour: z.number().min(1).max(10000).default(100),
  });

export const updateEmailSettingsSchema = insertEmailSettingsSchema.partial();

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type SetPassword = z.infer<typeof setPasswordSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSettingsSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type UpdateEmailSettings = z.infer<typeof updateEmailSettingsSchema>;
export type MetricsHistory = typeof metricsHistory.$inferSelect;
export type DbSchemaVersion = typeof dbSchemaVersion.$inferSelect;
