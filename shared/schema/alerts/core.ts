/**
 * Core alert schema tables.
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
  createInsertSchema,
  z,
} from "../base";
import { organizations } from "../core";
import { equipment } from "../equipment";
import { workOrders } from "../work-orders";
import { vessels } from "../vessels";

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
// Matches real DB: no vesselId, no severity columns.
export const alertNotifications = pgTable(
  "alert_notifications",
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
    alertType: text("alert_type").notNull(),
    message: text("message").notNull(),
    value: real("value").notNull(),
    threshold: real("threshold").notNull(),
    acknowledged: boolean("acknowledged").default(false),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
    acknowledgedBy: text("acknowledged_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgEquipmentTypeIdx: sql`CREATE INDEX IF NOT EXISTS idx_alert_notifications_org_equipment_type ON alert_notifications (org_id, equipment_id, alert_type)`,
  })
);

// Alert suppressions
// Real DB: equipment_id and sensor_type are NOT NULL plain text (no FK to equipment.id),
// reason is nullable, and there is an alert_type column.
export const alertSuppressions = pgTable(
  "alert_suppressions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    alertType: text("alert_type"),
    suppressedBy: text("suppressed_by").notNull(),
    reason: text("reason"),
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
