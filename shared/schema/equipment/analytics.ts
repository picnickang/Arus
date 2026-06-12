/**
 * Equipment analytics and operating condition schema tables.
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
  jsonb,
  unique,
  index,
  uuidPrimaryKey,
  timestamps,
  tenantColumn,
  versionTracking,
} from "../base";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { organizations } from "../core";
import { vessels } from "../vessels";
import { suppliers, parts } from "../inventory";
import { workOrders } from "../work-orders";
import { equipment } from "./core";

// ========================================
// Equipment Analytics Tables
// ========================================

// Downtime events
export const downtimeEvents = pgTable(
  "downtime_events",
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
    startTime: timestamp("start_time", { mode: "date" }).notNull(),
    endTime: timestamp("end_time", { mode: "date" }),
    durationHours: real("duration_hours"),
    reason: text("reason"),
    workOrderId: varchar("work_order_id").references(() => workOrders.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentIdx: index("idx_downtime_events_equipment").on(table.equipmentId),
    orgIdx: index("idx_downtime_events_org").on(table.orgId),
    startTimeIdx: index("idx_downtime_events_start").on(table.startTime),
  })
);

// Part failure history
export const partFailureHistory = pgTable(
  "part_failure_history",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    partId: varchar("part_id")
      .notNull()
      .references(() => parts.id),
    equipmentId: varchar("equipment_id").references(() => equipment.id),
    failureDate: timestamp("failure_date", { mode: "date" }).notNull(),
    failureMode: text("failure_mode"),
    rootCause: text("root_cause"),
    operatingHours: real("operating_hours"),
    downtimeHours: real("downtime_hours"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    partIdx: index("idx_part_failure_history_part").on(table.partId),
    equipmentIdx: index("idx_part_failure_history_equipment").on(table.equipmentId),
    dateIdx: index("idx_part_failure_history_date").on(table.failureDate),
  })
);

// Industry benchmarks
// P2 #17 — tenant scoping: GLOBAL (intentional). No org_id column.
// Benchmarks represent industry-wide reference values for an
// equipment type and are shared read-only across all tenants. If a
// tenant ever needs to override benchmarks privately, add a new
// `tenant_benchmarks` table rather than back-filling org_id here.
export const industryBenchmarks = pgTable(
  "industry_benchmarks",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    equipmentType: text("equipment_type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentTypeIdx: index("idx_industry_benchmarks_equipment").on(table.equipmentType),
  })
);

// Operating parameters — aligned with deployed PG (rich threshold model)
export const operatingParameters = pgTable(
  "operating_parameters",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentType: text("equipment_type").notNull(),
    manufacturer: text("manufacturer"),
    model: text("model"),
    parameterName: text("parameter_name").notNull(),
    parameterType: text("parameter_type").notNull(),
    unit: text("unit").notNull(),
    optimalMin: real("optimal_min"),
    optimalMax: real("optimal_max"),
    criticalMin: real("critical_min"),
    criticalMax: real("critical_max"),
    lifeImpactDescription: text("life_impact_description"),
    recommendedAction: text("recommended_action"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
    version: integer("version").default(1),
    lastModifiedBy: varchar("last_modified_by", { length: 255 }),
    lastModifiedDevice: varchar("last_modified_device", { length: 255 }),
  },
  (table) => ({
    parameterIdx: index("idx_operating_params_param").on(table.parameterName),
    typeIdx: index("idx_operating_params_type").on(table.equipmentType),
  })
);

// Operating condition alerts — aligned with deployed PG + boolean flags & created_at
// (boolean flags backfilled from timestamp columns via migration)
export const operatingConditionAlerts = pgTable(
  "operating_condition_alerts",
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
    parameterId: varchar("parameter_id")
      .notNull()
      .references(() => operatingParameters.id),
    parameterName: text("parameter_name").notNull(),
    parameterType: text("parameter_type"),
    currentValue: real("current_value").notNull(),
    optimalMin: real("optimal_min"),
    optimalMax: real("optimal_max"),
    thresholdType: text("threshold_type").notNull(),
    severity: text("severity").notNull().default("warning"),
    lifeImpact: text("life_impact"),
    recommendedAction: text("recommended_action"),
    acknowledged: boolean("acknowledged").default(false),
    resolved: boolean("resolved").default(false),
    alertedAt: timestamp("alerted_at", { mode: "date" }).notNull().defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
    acknowledgedBy: varchar("acknowledged_by"),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentIdx: index("idx_op_alerts_equipment").on(table.equipmentId),
    timeIdx: index("idx_op_alerts_time").on(table.alertedAt),
    activeIdx: index("idx_op_alerts_active").on(table.equipmentId, table.acknowledgedAt),
    resolvedIdx: index("idx_operating_condition_alerts_resolved").on(
      table.equipmentId,
      table.resolved
    ),
  })
);
