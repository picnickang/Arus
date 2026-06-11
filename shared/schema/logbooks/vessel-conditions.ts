/**
 * Logbook fuel, track, and condition summary schema tables.
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
  unique,
  index,
  createInsertSchema,
  z,
} from "../base";
import { organizations } from "../core";
import { vessels } from "../vessels";
import { crew } from "../crew";
import { workOrders } from "../work-orders";
import { equipment } from "../equipment";

// ============================================================================
// FUEL EMISSIONS LOG
// ============================================================================

// Real Postgres shape: period-based aggregated fuel & emissions log.
// Pre-reconcile this declared phantom log_date/fuel_type/consumption_mt/
// sox_emissions_mt/nox_emissions_mt/voyage_phase/eeoi_value/remarks columns
// that don't exist in the DB. The real DB splits fuel consumption by type
// (fo/do/lng/lo + total_fuel_mt), reports sox/nox in kg (not mt), and uses
// period_start/period_end timestamps instead of a log_date text field.
export const fuelEmissionsLog = pgTable(
  "fuel_emissions_log",
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
    periodStart: timestamp("period_start", { mode: "date" }).notNull(),
    periodEnd: timestamp("period_end", { mode: "date" }).notNull(),
    periodType: text("period_type").notNull().default("hourly"),
    foConsumptionMt: real("fo_consumption_mt"),
    doConsumptionMt: real("do_consumption_mt"),
    lngConsumptionMt: real("lng_consumption_mt"),
    loConsumptionMt: real("lo_consumption_mt"),
    totalFuelMt: real("total_fuel_mt"),
    co2EmissionsMt: real("co2_emissions_mt"),
    soxEmissionsKg: real("sox_emissions_kg"),
    noxEmissionsKg: real("nox_emissions_kg"),
    pmEmissionsKg: real("pm_emissions_kg"),
    avgEngineLoad: real("avg_engine_load"),
    avgGeneratorLoad: real("avg_generator_load"),
    meRunningHours: real("me_running_hours"),
    dgRunningHours: real("dg_running_hours"),
    distanceNm: real("distance_nm"),
    avgSpeedKn: real("avg_speed_kn"),
    fuelEfficiencyMtPerNm: real("fuel_efficiency_mt_per_nm"),
    sfocGPerKwh: real("sfoc_g_per_kwh"),
    eeoi: real("eeoi"),
    cii: real("cii"),
    ciiRating: text("cii_rating"),
    dataSource: text("data_source").notNull().default("estimated"),
    dataQuality: text("data_quality").default("medium"),
    confidenceScore: real("confidence_score"),
    calculationMethod: text("calculation_method"),
    calculationDetails: jsonb("calculation_details"),
    voyageId: varchar("voyage_id"),
    voyageLegId: varchar("voyage_leg_id"),
    createdByUserId: varchar("created_by_user_id"),
    createdByUserName: text("created_by_user_name"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_fuel_emissions_log_org").on(table.orgId),
    periodStartIdx: index("idx_fuel_emissions_log_period_start").on(table.periodStart),
    periodTypeIdx: index("idx_fuel_emissions_log_period_type").on(table.periodType),
    vesselIdx: index("idx_fuel_emissions_log_vessel").on(table.vesselId),
    vesselPeriodIdx: index("idx_fuel_emissions_log_vessel_period").on(
      table.vesselId,
      table.periodStart
    ),
    voyageIdx: index("idx_fuel_emissions_log_voyage").on(table.voyageId),
  })
);

export const insertFuelEmissionsLogSchema = createInsertSchema(fuelEmissionsLog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FuelEmissionsLog = typeof fuelEmissionsLog.$inferSelect;
export type InsertFuelEmissionsLog = z.infer<typeof insertFuelEmissionsLogSchema>;

// ============================================================================
// VESSEL TRACK LOG
// ============================================================================

export const vesselTrackLog = pgTable(
  "vessel_track_log",
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
    timestamp: timestamp("timestamp", { mode: "date" }).notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    heading: real("heading"),
    sog: real("sog"),
    cog: real("cog"),
    equipmentId: varchar("equipment_id"),
    source: text("source").default("ais"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_vessel_track_org").on(table.orgId),
    vesselTimestampIdx: index("idx_vessel_track_vessel_ts").on(table.vesselId, table.timestamp),
  })
);

export const insertVesselTrackLogSchema = createInsertSchema(vesselTrackLog).omit({
  id: true,
  createdAt: true,
});

export type VesselTrackLog = typeof vesselTrackLog.$inferSelect;
export type InsertVesselTrackLog = z.infer<typeof insertVesselTrackLogSchema>;

// ============================================================================
// CONDITION LOG SUMMARY
// ============================================================================

export const conditionLogSummary = pgTable(
  "condition_log_summary",
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
    equipmentId: varchar("equipment_id").references(() => equipment.id),
    healthGrade: text("health_grade"),
    conditionRating: text("condition_rating"),
    healthIndex: real("health_index"),
    rulDays: integer("rul_days"),
    periodStart: timestamp("period_start", { mode: "date" }),
    periodEnd: timestamp("period_end", { mode: "date" }),
    vibrationRmsAvg: real("vibration_rms_avg"),
    mlAnomalyScoreAvg: real("ml_anomaly_score_avg"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_condition_log_org").on(table.orgId),
    vesselIdx: index("idx_condition_log_vessel").on(table.vesselId),
    equipmentIdx: index("idx_condition_log_equipment").on(table.equipmentId),
  })
);

export const insertConditionLogSummarySchema = createInsertSchema(conditionLogSummary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ConditionLogSummary = typeof conditionLogSummary.$inferSelect;
export type InsertConditionLogSummary = z.infer<typeof insertConditionLogSummarySchema>;
