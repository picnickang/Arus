/**
 * Engine room logbook schema tables.
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
// ENGINE ROOM LOGBOOK
// ============================================================================

export const engineLogDaily = pgTable(
  "engine_log_daily",
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
    logDate: text("log_date").notNull(),
    mainEngineHoursStart: real("me_hours_start"),
    mainEngineHoursEnd: real("me_hours_end"),
    mainEngineHoursToday: real("me_hours_today"),
    generator1HoursToday: real("gen1_hours_today"),
    generator2HoursToday: real("gen2_hours_today"),
    generator3HoursToday: real("gen3_hours_today"),
    auxiliaryEngineHoursToday: real("aux_hours_today"),
    fuelMeConsumption: real("fuel_me_consumption"),
    fuelDgConsumption: real("fuel_dg_consumption"),
    fuelAuxConsumption: real("fuel_aux_consumption"),
    fuelTotalConsumption: real("fuel_total_consumption"),
    lubOilConsumption: real("lub_oil_consumption"),
    fuelHfoRob: real("fuel_hfo_rob"),
    fuelMdoRob: real("fuel_mdo_rob"),
    fuelMgoRob: real("fuel_mgo_rob"),
    lubOilRob: real("lub_oil_rob"),
    freshWaterRob: real("fresh_water_rob"),
    fuelTank1Level: real("fuel_tank1_level"),
    fuelTank2Level: real("fuel_tank2_level"),
    lubOilSumpLevel: real("lub_oil_sump_level"),
    bilgeLevel: real("bilge_level"),
    bunkeringHfo: real("bunkering_hfo"),
    bunkeringMdo: real("bunkering_mdo"),
    bunkeringMgo: real("bunkering_mgo"),
    bunkeringPort: text("bunkering_port"),
    bunkeringSupplier: text("bunkering_supplier"),
    voyageStatus: text("voyage_status"),
    remarks: text("remarks"),
    maintenanceRemarks: text("maintenance_remarks"),
    alarmsRemarks: text("alarms_remarks"),
    chiefEngineerId: varchar("chief_engineer_id").references(() => crew.id),
    chiefEngineerName: text("chief_engineer_name"),
    dutyEngineerId: varchar("duty_engineer_id").references(() => crew.id),
    dutyEngineerName: text("duty_engineer_name"),
    signedByCrewId: varchar("signed_by_crew_id").references(() => crew.id),
    signedByName: text("signed_by_name"),
    signedByRank: text("signed_by_rank"),
    signedAt: timestamp("signed_at", { mode: "date" }),
    status: text("status").default("open"),
    lockedAt: timestamp("locked_at", { mode: "date" }),
    lockedByUserId: varchar("locked_by_user_id"),
    lockedByUserName: text("locked_by_user_name"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_engine_log_daily_org").on(table.orgId),
    vesselDateIdx: index("idx_engine_log_daily_vessel_date").on(table.vesselId, table.logDate),
    uniqueVesselDate: unique("uq_engine_log_vessel_date").on(table.vesselId, table.logDate),
    statusIdx: index("idx_engine_log_daily_status").on(table.status),
  })
);

export const insertEngineLogDailySchema = createInsertSchema(engineLogDaily).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EngineLogDaily = typeof engineLogDaily.$inferSelect;
export type InsertEngineLogDaily = z.infer<typeof insertEngineLogDailySchema>;

export const engineLogHourly = pgTable(
  "engine_log_hourly",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    dailyLogId: varchar("daily_log_id")
      .notNull()
      .references(() => engineLogDaily.id, { onDelete: "cascade" }),
    hour: integer("hour").notNull(),
    meRpm: integer("me_rpm"),
    meLoad: real("me_load"),
    meFuelRackPosition: real("me_fuel_rack"),
    meExhaustTempPort: real("me_exhaust_temp_port"),
    meExhaustTempStbd: real("me_exhaust_temp_stbd"),
    meScavAirPress: real("me_scav_air_press"),
    meScavAirTemp: real("me_scav_air_temp"),
    meTurbochargerRpm: integer("me_tc_rpm"),
    meTurbochargerExhaustTemp: real("me_tc_exhaust_temp"),
    meCoolantTempIn: real("me_coolant_temp_in"),
    meCoolantTempOut: real("me_coolant_temp_out"),
    meLubOilPress: real("me_lub_oil_press"),
    meLubOilTemp: real("me_lub_oil_temp"),
    meFuelOilPress: real("me_fuel_oil_press"),
    meFuelOilTemp: real("me_fuel_oil_temp"),
    meFuelOilViscosity: real("me_fuel_oil_visc"),
    seaWaterCoolingTemp: real("sw_cooling_temp"),
    freshWaterCoolingTemp: real("fw_cooling_temp"),
    airCompressorPress: real("air_comp_press"),
    startingAirPress: real("starting_air_press"),
    controlAirPress: real("control_air_press"),
    engineRoomTemp: real("er_temp"),
    engineRoomHumidity: real("er_humidity"),
    meRunningHours: real("me_running_hours"),
    remarks: text("remarks"),
    recordedByCrewId: varchar("recorded_by_crew_id").references(() => crew.id),
    recordedByName: text("recorded_by_name"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    dailyLogIdx: index("idx_engine_log_hourly_daily").on(table.dailyLogId),
    uniqueHour: unique("uq_engine_log_hourly_hour").on(table.dailyLogId, table.hour),
  })
);

export const insertEngineLogHourlySchema = createInsertSchema(engineLogHourly).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EngineLogHourly = typeof engineLogHourly.$inferSelect;
export type InsertEngineLogHourly = z.infer<typeof insertEngineLogHourlySchema>;

export const engineLogGenerator = pgTable(
  "engine_log_generator",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    dailyLogId: varchar("daily_log_id")
      .notNull()
      .references(() => engineLogDaily.id, { onDelete: "cascade" }),
    hour: integer("hour").notNull(),
    generatorNumber: integer("generator_number").notNull(),
    isRunning: boolean("is_running").default(false),
    loadKw: real("load_kw"),
    loadPercent: real("load_percent"),
    voltageL1: real("voltage_l1"),
    voltageL2: real("voltage_l2"),
    voltageL3: real("voltage_l3"),
    currentL1: real("current_l1"),
    currentL2: real("current_l2"),
    currentL3: real("current_l3"),
    frequency: real("frequency"),
    powerFactor: real("power_factor"),
    rpm: integer("rpm"),
    exhaustTemp: real("exhaust_temp"),
    coolantTemp: real("coolant_temp"),
    lubOilPress: real("lub_oil_press"),
    lubOilTemp: real("lub_oil_temp"),
    fuelPress: real("fuel_press"),
    runningHours: real("running_hours"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    dailyLogIdx: index("idx_engine_log_gen_daily").on(table.dailyLogId),
    uniqueGenHour: unique("uq_engine_log_gen_hour").on(
      table.dailyLogId,
      table.hour,
      table.generatorNumber
    ),
  })
);

export const insertEngineLogGeneratorSchema = createInsertSchema(engineLogGenerator).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EngineLogGenerator = typeof engineLogGenerator.$inferSelect;
export type InsertEngineLogGenerator = z.infer<typeof insertEngineLogGeneratorSchema>;

export const engineLogWatch = pgTable(
  "engine_log_watch",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    dailyLogId: varchar("daily_log_id")
      .notNull()
      .references(() => engineLogDaily.id, { onDelete: "cascade" }),
    watchPeriod: text("watch_period").notNull(),
    watchEngineerId: varchar("watch_engineer_id").references(() => crew.id),
    watchEngineerName: text("watch_engineer_name"),
    motormanIds: jsonb("motorman_ids").$type<string[]>().default([]),
    motormanNames: text("motorman_names"),
    voyageStatusStart: text("voyage_status_start"),
    voyageStatusEnd: text("voyage_status_end"),
    mainEngineStatus: text("me_status"),
    generatorsOnLine: integer("generators_on_line"),
    handoverNotes: text("handover_notes"),
    alarmsTripped: text("alarms_tripped"),
    maintenancePerformed: text("maintenance_performed"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    dailyLogIdx: index("idx_engine_log_watch_daily").on(table.dailyLogId),
    uniqueWatch: unique("uq_engine_log_watch_period").on(table.dailyLogId, table.watchPeriod),
  })
);

export const insertEngineLogWatchSchema = createInsertSchema(engineLogWatch).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EngineLogWatch = typeof engineLogWatch.$inferSelect;
export type InsertEngineLogWatch = z.infer<typeof insertEngineLogWatchSchema>;

export const engineLogEvents = pgTable(
  "engine_log_events",
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
    dayId: varchar("day_id")
      .notNull()
      .references(() => engineLogDaily.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { mode: "date" }).notNull(),
    eventType: text("event_type").notNull(),
    source: text("source").notNull().default("manual"),
    summary: text("summary").notNull(),
    details: text("details"),
    equipmentType: text("equipment_type"),
    equipmentId: varchar("equipment_id").references(() => equipment.id),
    meRpm: integer("me_rpm"),
    meLoad: real("me_load"),
    meLubOilPress: real("me_lub_oil_press"),
    meExhaustTemp: real("me_exhaust_temp"),
    dgNumber: integer("dg_number"),
    dgLoadKw: real("dg_load_kw"),
    dgVoltage: real("dg_voltage"),
    dgFrequency: real("dg_frequency"),
    alarmCode: text("alarm_code"),
    alarmSeverity: text("alarm_severity"),
    alarmAcknowledgedAt: timestamp("alarm_ack_at", { mode: "date" }),
    alarmClearedAt: timestamp("alarm_cleared_at", { mode: "date" }),
    workOrderId: varchar("work_order_id").references(() => workOrders.id),
    alertId: varchar("alert_id"),
    crewMemberId: varchar("crew_member_id").references(() => crew.id),
    createdByUserId: varchar("created_by_user_id"),
    createdByUserName: text("created_by_user_name"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_engine_log_events_org").on(table.orgId),
    vesselIdIdx: index("idx_engine_log_events_vessel").on(table.vesselId),
    dayIdIdx: index("idx_engine_log_events_day").on(table.dayId),
    timestampIdx: index("idx_engine_log_events_timestamp").on(table.timestamp),
    eventTypeIdx: index("idx_engine_log_events_type").on(table.eventType),
    sourceIdx: index("idx_engine_log_events_source").on(table.source),
    idempotencyIdx: unique("uq_engine_log_events_idempotency").on(table.idempotencyKey),
  })
);

export const insertEngineLogEventsSchema = createInsertSchema(engineLogEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EngineLogEvent = typeof engineLogEvents.$inferSelect;
export type InsertEngineLogEvent = z.infer<typeof insertEngineLogEventsSchema>;

export const ENGINE_LOG_EVENT_TYPES = {
  ME_START: "ME_START",
  ME_STOP: "ME_STOP",
  ME_STANDBY: "ME_STANDBY",
  DG_START: "DG_START",
  DG_STOP: "DG_STOP",
  DG_PARALLEL: "DG_PARALLEL",
  LOAD_CHANGE: "LOAD_CHANGE",
  ALARM_TRIGGERED: "ALARM_TRIGGERED",
  ALARM_ACKNOWLEDGED: "ALARM_ACKNOWLEDGED",
  ALARM_CLEARED: "ALARM_CLEARED",
  TRIP: "TRIP",
  MAINTENANCE_START: "MAINTENANCE_START",
  MAINTENANCE_END: "MAINTENANCE_END",
  FUEL_CHANGEOVER: "FUEL_CHANGEOVER",
  BUNKER_START: "BUNKER_START",
  BUNKER_END: "BUNKER_END",
  OIL_ADDITION: "OIL_ADDITION",
  FILTER_CHANGE: "FILTER_CHANGE",
  PURIFIER_START: "PURIFIER_START",
  PURIFIER_STOP: "PURIFIER_STOP",
  COMPRESSOR_START: "COMPRESSOR_START",
  COMPRESSOR_STOP: "COMPRESSOR_STOP",
  WATCH_CHANGE: "WATCH_CHANGE",
  CREW_CHANGE: "CREW_CHANGE",
  WORK_ORDER_ACTION: "WORK_ORDER_ACTION",
  MANUAL_ENTRY: "MANUAL_ENTRY",
  REMARK: "REMARK",
  INSPECTION: "INSPECTION",
  TEST: "TEST",
} as const;

export const ENGINE_LOG_EVENT_SOURCES = {
  TELEMETRY: "telemetry",
  MANUAL: "manual",
  WORK_ORDER: "work_order",
  ALERT: "alert",
  SYSTEM: "system",
} as const;
