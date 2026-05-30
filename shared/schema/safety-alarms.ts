/**
 * Schema: Safety Alarms (Emergency)
 *
 * Cloud-only (PostgreSQL) domain — mirrors the safety-bulletins pattern:
 * not registered in schema-runtime and has no SQLite mirror.
 *
 * Separate from safety bulletins: alarms are configurable emergency types
 * (fire, man-overboard, …) that can be triggered active/cleared against a
 * vessel or fleet-wide (null vesselId), with acknowledgement tracking.
 *
 * NOTE: in-app emergency notice only — never a replacement for physical
 * alarms or muster procedures.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  unique,
  index,
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";
import { vessels } from "./vessels";

export const safetyAlarmTypes = pgTable(
  "safety_alarm_types",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    key: text("key").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    defaultSeverity: text("default_severity").notNull().default("critical"),
    icon: text("icon"),
    color: text("color"),
    requiresAcknowledgement: boolean("requires_acknowledgement").notNull().default(true),
    isProtected: boolean("is_protected").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: varchar("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgKeyUnique: unique("uq_safety_alarm_type_org_key").on(table.orgId, table.key),
    orgActiveIdx: index("idx_safety_alarm_type_org_active").on(table.orgId, table.isActive),
  }),
);

export const vesselSafetyAlarms = pgTable(
  "vessel_safety_alarms",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    alarmTypeId: varchar("alarm_type_id")
      .notNull()
      .references(() => safetyAlarmTypes.id),
    // Null vesselId => fleet-wide alarm visible to every vessel.
    vesselId: varchar("vessel_id").references(() => vessels.id),
    title: text("title").notNull(),
    message: text("message"),
    severity: text("severity").notNull().default("critical"),
    mode: text("mode").notNull().default("real"),
    status: text("status").notNull().default("active"),
    requiresAcknowledgement: boolean("requires_acknowledgement").notNull().default(true),
    triggeredBy: varchar("triggered_by"),
    triggeredByName: text("triggered_by_name"),
    triggeredAt: timestamp("triggered_at", { mode: "date" }).defaultNow(),
    clearedBy: varchar("cleared_by"),
    clearedByName: text("cleared_by_name"),
    clearedAt: timestamp("cleared_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgStatusIdx: index("idx_vessel_safety_alarm_org_status").on(
      table.orgId,
      table.status,
      table.triggeredAt,
    ),
    orgVesselIdx: index("idx_vessel_safety_alarm_org_vessel").on(table.orgId, table.vesselId),
  }),
);

export const vesselSafetyAlarmAcknowledgements = pgTable(
  "vessel_safety_alarm_acknowledgements",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    alarmId: varchar("alarm_id")
      .notNull()
      .references(() => vesselSafetyAlarms.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull(),
    userName: text("user_name"),
    source: text("source"),
    comment: text("comment"),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    alarmUserUnique: unique("uq_alarm_ack_alarm_user").on(table.alarmId, table.userId),
    alarmIdx: index("idx_alarm_ack_alarm").on(table.alarmId),
  }),
);

export const insertSafetyAlarmTypeSchema = createInsertSchema(safetyAlarmTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVesselSafetyAlarmSchema = createInsertSchema(vesselSafetyAlarms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVesselSafetyAlarmAcknowledgementSchema = createInsertSchema(
  vesselSafetyAlarmAcknowledgements,
).omit({ id: true });

export type SafetyAlarmType = typeof safetyAlarmTypes.$inferSelect;
export type InsertSafetyAlarmType = z.infer<typeof insertSafetyAlarmTypeSchema>;
export type VesselSafetyAlarm = typeof vesselSafetyAlarms.$inferSelect;
export type InsertVesselSafetyAlarm = z.infer<typeof insertVesselSafetyAlarmSchema>;
export type VesselSafetyAlarmAcknowledgement =
  typeof vesselSafetyAlarmAcknowledgements.$inferSelect;
export type InsertVesselSafetyAlarmAcknowledgement = z.infer<
  typeof insertVesselSafetyAlarmAcknowledgementSchema
>;
