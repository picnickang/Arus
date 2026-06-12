/**
 * Alert email and notification queue schema tables.
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
import { purchaseRequests } from "../purchasing";
import { suppliers } from "../inventory";

// ============================================================================
// EMAIL QUEUE
// ============================================================================

export const emailQueue = pgTable(
  "email_queue",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    prId: varchar("pr_id").references(() => purchaseRequests.id),
    supplierId: varchar("supplier_id").references(() => suppliers.id),
    recipientEmail: text("recipient_email").notNull(),
    recipientName: text("recipient_name"),
    subject: text("subject").notNull(),
    htmlContent: text("html_content").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").default(0),
    lastAttemptAt: timestamp("last_attempt_at", { mode: "date" }),
    sentAt: timestamp("sent_at", { mode: "date" }),
    errorMessage: text("error_message"),
    nextRetryAt: timestamp("next_retry_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue (status, created_at)`,
    prIdx: sql`CREATE INDEX IF NOT EXISTS idx_email_queue_pr ON email_queue (pr_id)`,
  })
);

export const insertEmailQueueSchema = createInsertSchema(emailQueue).omit({
  id: true,
  createdAt: true,
});

export type EmailQueue = typeof emailQueue.$inferSelect;
export type InsertEmailQueue = z.infer<typeof insertEmailQueueSchema>;

// ============================================================================
// NOTIFICATION SETTINGS
// ============================================================================

export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    notificationType: text("notification_type").notNull(),
    enabled: boolean("enabled").default(true),
    minSeverity: text("min_severity").default("warning"),
    recipientEmails: jsonb("recipient_emails").$type<string[]>(),
    recipientRoles: jsonb("recipient_roles").$type<string[]>(),
    recipientUserIds: jsonb("recipient_user_ids").$type<string[]>(),
    deliveryMethod: text("delivery_method").default("email"),
    webhookUrl: text("webhook_url"),
    digestMode: boolean("digest_mode").default(false),
    digestSchedule: text("digest_schedule"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_notification_settings_org").on(table.orgId),
    vesselIdIdx: index("idx_notification_settings_vessel").on(table.vesselId),
    typeIdx: index("idx_notification_settings_type").on(table.notificationType),
  })
);

export const insertOrgNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrgNotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertOrgNotificationSettings = z.infer<typeof insertOrgNotificationSettingsSchema>;

// ============================================================================
// NOTIFICATION QUEUE
// ============================================================================

export const notificationQueue = pgTable(
  "notification_queue",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    notificationType: text("notification_type").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    bodyHtml: text("body_html"),
    recipients: jsonb("recipients").$type<string[]>().notNull(),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: varchar("related_entity_id"),
    status: text("status").default("pending"),
    attemptCount: integer("attempt_count").default(0),
    lastAttemptAt: timestamp("last_attempt_at", { mode: "date" }),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { mode: "date" }),
    scheduledFor: timestamp("scheduled_for", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_notification_queue_org").on(table.orgId),
    statusIdx: index("idx_notification_queue_status").on(table.status),
    scheduledIdx: index("idx_notification_queue_scheduled").on(table.scheduledFor),
  })
);

export const insertNotificationQueueSchema = createInsertSchema(notificationQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type NotificationQueue = typeof notificationQueue.$inferSelect;
export type InsertNotificationQueue = z.infer<typeof insertNotificationQueueSchema>;
