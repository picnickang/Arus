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
  numeric,
  timestamp,
  boolean,
  serial,
  index,
  uniqueIndex,
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
  emergencyLaborMultiplier: numeric("emergency_labor_multiplier", { precision: 6, scale: 3, mode: "number" }).default(3),
  emergencyPartsMultiplier: numeric("emergency_parts_multiplier", { precision: 6, scale: 3, mode: "number" }).default(1.5),
  emergencyDowntimeMultiplier: numeric("emergency_downtime_multiplier", { precision: 6, scale: 3, mode: "number" }).default(3),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Users with RBAC scaffolding and authentication
export const users = pgTable(
  "users",
  {
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
  // password_reset_token/_expires dropped in 0049: no reset flow ever
  // shipped (zero readers/writers). If one is added, store only a hash
  // of the token from day one.
  passwordUpdatedAt: timestamp("password_updated_at", { mode: "date" }),
  role: text("role").notNull().default("viewer"),
  jobTitle: text("job_title"),
  phone: text("phone"),
  timezone: text("timezone").default("UTC"),
  isActive: boolean("is_active").default(true),
  loginEnabled: boolean("login_enabled").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  supervisorUserId: varchar("supervisor_user_id"),
  // Explicit grant of admin-portal ("hub") access. Distinct from `role`: a
  // manager-or-above user must be explicitly granted hub access before the
  // admin hubs become reachable. Super-admin roles are always-on regardless.
  hubAdmin: boolean("hub_admin").notNull().default(false),
  // Per-admin hub allow-list (nav category ids). null = all hubs (full access).
  hubAccess: text("hub_access").array(),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    // Tenant-scoped natural key (0039): the same email may exist in
    // different orgs, never twice within one.
    orgEmailUq: uniqueIndex("uq_users_org_email").on(table.orgId, table.email),
  })
);

// System settings
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default("system"),
  hmacRequired: boolean("hmac_required").default(false),
  maxPayloadBytes: integer("max_payload_bytes").default(2097152),
  strictUnits: boolean("strict_units").default(false),
  llmEnabled: boolean("llm_enabled").default(true),
  llmModel: text("llm_model").default("gpt-4o-mini"),
  // Legacy plaintext column — kept for 0043 rollback compatibility; the
  // boot backfill moves any value into openaiApiKeyEncrypted and NULLs it.
  openaiApiKey: text("openai_api_key"),
  // AES-256-GCM via server/lib/crypto-service.ts (0043). Never returned
  // by the API; PUT /api/settings accepts a plaintext key and encrypts.
  openaiApiKeyEncrypted: text("openai_api_key_encrypted"),
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

export type EmailProvider = (typeof EMAIL_PROVIDERS)[keyof typeof EMAIL_PROVIDERS];

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
  name: text("name"),
  appliedAt: timestamp("applied_at", { mode: "date" }).defaultNow(),
});

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    subscriptionTier: z.enum(["basic", "pro", "enterprise"]).default("basic"),
    slug: z
      .string()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9-]+$/),
    name: z.string().min(2).max(100),
    maxUsers: z.number().min(1).max(10000).default(50),
    maxEquipment: z.number().min(1).max(100000).default(1000),
  });

export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    lastLoginAt: true,
    passwordHash: true,
    passwordUpdatedAt: true,
    hubAdmin: true,
    hubAccess: true,
  })
  .extend({
    role: z.enum(["admin", "manager", "technician", "viewer"]).default("viewer"),
    email: z.string().email(),
    name: z.string().min(2).max(100),
    username: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional()
      .nullable(),
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

// openaiApiKey stays accepted as WRITE-ONLY input (the storage layer
// encrypts it); the encrypted column is never client-settable.
export const insertSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  openaiApiKeyEncrypted: true,
});

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
export type InsertSettings = InsertSystemSettings;
export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type UpdateEmailSettings = z.infer<typeof updateEmailSettingsSchema>;
export type MetricsHistory = typeof metricsHistory.$inferSelect;
export type DbSchemaVersion = typeof dbSchemaVersion.$inferSelect;
