/**
 * Schema DTC - Diagnostic Trouble Codes (J1939)
 * 
 * DTC definitions and fault tracking for marine equipment diagnostics.
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
} from "./base";
import { organizations } from "./core";
import { equipment, devices } from "./equipment";

// ============================================================================
// DTC DEFINITIONS - J1939 SPN/FMI Mappings
// ============================================================================

export const dtcDefinitions = pgTable(
  "dtc_definitions",
  {
    spn: integer("spn").notNull(),
    fmi: integer("fmi").notNull(),
    manufacturer: text("manufacturer").notNull().default(""),
    spnName: text("spn_name").notNull(),
    fmiName: text("fmi_name").notNull(),
    description: text("description").notNull(),
    severity: integer("severity").notNull().default(3),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    pk: sql`PRIMARY KEY (${table.spn}, ${table.fmi}, ${table.manufacturer})`,
    spnIdx: index("idx_dtc_definitions_spn").on(table.spn),
    severityIdx: index("idx_dtc_definitions_severity").on(table.severity),
  })
);

export const insertDtcDefinitionSchema = createInsertSchema(dtcDefinitions).omit({
  createdAt: true,
  updatedAt: true,
});

export type DtcDefinition = typeof dtcDefinitions.$inferSelect;
export type InsertDtcDefinition = z.infer<typeof insertDtcDefinitionSchema>;

// ============================================================================
// DTC FAULTS - Active and Historical Diagnostic Trouble Codes
// ============================================================================

export const dtcFaults = pgTable(
  "dtc_faults",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    equipmentId: varchar("equipment_id").notNull().references(() => equipment.id),
    deviceId: varchar("device_id").notNull().references(() => devices.id),
    spn: integer("spn").notNull(),
    fmi: integer("fmi").notNull(),
    oc: integer("oc"),
    sa: integer("sa"),
    pgn: integer("pgn"),
    lamp: jsonb("lamp"),
    active: boolean("active").notNull().default(true),
    firstSeen: timestamp("first_seen", { mode: "date" }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    version: integer("version").default(1),
    lastModifiedBy: varchar("last_modified_by", { length: 255 }),
    lastModifiedDevice: varchar("last_modified_device", { length: 255 }),
  },
  (table) => ({
    orgEquipmentActiveIdx: index("idx_dtc_faults_org_eq_active").on(
      table.orgId,
      table.equipmentId,
      table.active
    ),
    deviceActiveIdx: index("idx_dtc_faults_device_active").on(table.deviceId, table.active),
    lastSeenIdx: index("idx_dtc_faults_last_seen").on(table.orgId, table.lastSeen),
    activePartialIdx: sql`CREATE INDEX IF NOT EXISTS idx_dtc_faults_active_only ON dtc_faults (org_id, equipment_id, last_seen DESC) WHERE active = true`,
  })
);

export const insertDtcFaultSchema = createInsertSchema(dtcFaults).omit({
  id: true,
  createdAt: true,
});

export type DtcFault = typeof dtcFaults.$inferSelect;
export type InsertDtcFault = z.infer<typeof insertDtcFaultSchema>;
