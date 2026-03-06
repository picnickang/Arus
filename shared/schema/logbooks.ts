/**
 * Schema Logbooks - Digital Deck and Engine Room Logbooks
 * 
 * Maritime compliance feature for regulatory requirements (IMO SOLAS, ISM Code).
 * Based on professional marine logbook standards (SeaLogs, K-Fleet, NOZZLE).
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
} from "./base";
import { organizations } from "./core";
import { vessels } from "./vessels";
import { crew } from "./crew";
import { workOrders } from "./work-orders";
import { equipment } from "./equipment";

// ============================================================================
// DIGITAL DECK LOGBOOK
// ============================================================================

export const deckLogDaily = pgTable(
  "deck_log_daily",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
    logDate: text("log_date").notNull(),
    trueCourseNoon: real("true_course_noon"),
    dayRun: real("day_run"),
    totalDistance: real("total_distance"),
    latitudeAccount: real("latitude_account"),
    longitudeAccount: real("longitude_account"),
    latitudeObserved: real("latitude_observed"),
    longitudeObserved: real("longitude_observed"),
    streamingHoursToday: real("streaming_hours_today"),
    streamingHoursTotal: real("streaming_hours_total"),
    draftForward: real("draft_forward"),
    draftMid: real("draft_mid"),
    draftAft: real("draft_aft"),
    draftTrim: real("draft_trim"),
    fuelRemaining: real("fuel_remaining"),
    fuelConsumedToday: real("fuel_consumed_today"),
    freshWaterRemaining: real("fresh_water_remaining"),
    remarks: text("remarks"),
    weatherSummary: text("weather_summary"),
    seaStateSummary: text("sea_state_summary"),
    masterOnWatchId: varchar("master_on_watch_id").references(() => crew.id),
    masterOnWatchName: text("master_on_watch_name"),
    chiefEngineerId: varchar("chief_engineer_id").references(() => crew.id),
    chiefEngineerName: text("chief_engineer_name"),
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
    orgIdIdx: index("idx_deck_log_daily_org").on(table.orgId),
    vesselDateIdx: index("idx_deck_log_daily_vessel_date").on(table.vesselId, table.logDate),
    uniqueVesselDate: unique("uq_deck_log_vessel_date").on(table.vesselId, table.logDate),
    statusIdx: index("idx_deck_log_daily_status").on(table.status),
  })
);

export const insertDeckLogDailySchema = createInsertSchema(deckLogDaily).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DeckLogDaily = typeof deckLogDaily.$inferSelect;
export type InsertDeckLogDaily = z.infer<typeof insertDeckLogDailySchema>;

export const deckLogHourly = pgTable(
  "deck_log_hourly",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    dailyLogId: varchar("daily_log_id").notNull().references(() => deckLogDaily.id, { onDelete: "cascade" }),
    hour: integer("hour").notNull(),
    courseTrue: real("course_true"),
    courseGyro: real("course_gyro"),
    courseStandard: real("course_standard"),
    courseSteering: real("course_steering"),
    errorGyro: real("error_gyro"),
    errorStandard: real("error_standard"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    speed: real("speed"),
    logReading: real("log_reading"),
    windDirection: text("wind_direction"),
    windForce: integer("wind_force"),
    seaState: integer("sea_state"),
    swellDirection: text("swell_direction"),
    swellHeight: real("swell_height"),
    skyCondition: text("sky_condition"),
    visibility: integer("visibility"),
    barometer: real("barometer"),
    airTemperature: real("air_temperature"),
    seaTemperature: real("sea_temperature"),
    humidity: real("humidity"),
    engineHours: real("engine_hours"),
    generatorHours: real("generator_hours"),
    mainEngineRpm: integer("main_engine_rpm"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    dailyLogIdx: index("idx_deck_log_hourly_daily").on(table.dailyLogId),
    uniqueHour: unique("uq_deck_log_hourly_hour").on(table.dailyLogId, table.hour),
  })
);

export const insertDeckLogHourlySchema = createInsertSchema(deckLogHourly).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DeckLogHourly = typeof deckLogHourly.$inferSelect;
export type InsertDeckLogHourly = z.infer<typeof insertDeckLogHourlySchema>;

export const deckLogWatch = pgTable(
  "deck_log_watch",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    dailyLogId: varchar("daily_log_id").notNull().references(() => deckLogDaily.id, { onDelete: "cascade" }),
    watchPeriod: text("watch_period").notNull(),
    watchOfficerId: varchar("watch_officer_id").references(() => crew.id),
    watchOfficerName: text("watch_officer_name"),
    wheelCrewIds: jsonb("wheel_crew_ids").$type<string[]>().default([]),
    wheelCrewNames: text("wheel_crew_names"),
    lookoutCrewIds: jsonb("lookout_crew_ids").$type<string[]>().default([]),
    lookoutCrewNames: text("lookout_crew_names"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    dailyLogIdx: index("idx_deck_log_watch_daily").on(table.dailyLogId),
    uniqueWatch: unique("uq_deck_log_watch_period").on(table.dailyLogId, table.watchPeriod),
  })
);

export const insertDeckLogWatchSchema = createInsertSchema(deckLogWatch).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DeckLogWatch = typeof deckLogWatch.$inferSelect;
export type InsertDeckLogWatch = z.infer<typeof insertDeckLogWatchSchema>;

export const deckLogEvents = pgTable(
  "deck_log_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
    dayId: varchar("day_id").notNull().references(() => deckLogDaily.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { mode: "date" }).notNull(),
    eventType: text("event_type").notNull(),
    source: text("source").notNull().default("manual"),
    summary: text("summary").notNull(),
    details: text("details"),
    positionLat: real("position_lat"),
    positionLon: real("position_lon"),
    speedOverGround: real("speed_over_ground"),
    courseOverGround: real("course_over_ground"),
    heading: real("heading"),
    engineRpmPort: integer("engine_rpm_port"),
    engineRpmStbd: integer("engine_rpm_stbd"),
    engineHoursPort: real("engine_hours_port"),
    engineHoursStbd: real("engine_hours_stbd"),
    fuelRobTons: real("fuel_rob_tons"),
    fuelConsumed: real("fuel_consumed"),
    distanceRunNm: real("distance_run_nm"),
    distanceToGoNm: real("distance_to_go_nm"),
    workOrderId: varchar("work_order_id").references(() => workOrders.id),
    alertId: varchar("alert_id"),
    crewMemberId: varchar("crew_member_id").references(() => crew.id),
    equipmentId: varchar("equipment_id").references(() => equipment.id),
    createdByUserId: varchar("created_by_user_id"),
    createdByUserName: text("created_by_user_name"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_deck_log_events_org").on(table.orgId),
    vesselIdIdx: index("idx_deck_log_events_vessel").on(table.vesselId),
    dayIdIdx: index("idx_deck_log_events_day").on(table.dayId),
    timestampIdx: index("idx_deck_log_events_timestamp").on(table.timestamp),
    eventTypeIdx: index("idx_deck_log_events_type").on(table.eventType),
    sourceIdx: index("idx_deck_log_events_source").on(table.source),
    idempotencyIdx: unique("uq_deck_log_events_idempotency").on(table.idempotencyKey),
  })
);

export const insertDeckLogEventsSchema = createInsertSchema(deckLogEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DeckLogEvent = typeof deckLogEvents.$inferSelect;
export type InsertDeckLogEvent = z.infer<typeof insertDeckLogEventsSchema>;

export const DECK_LOG_EVENT_TYPES = {
  ENGINE_START: "ENGINE_START",
  ENGINE_STOP: "ENGINE_STOP",
  DEPARTURE: "DEPARTURE",
  ARRIVAL: "ARRIVAL",
  FUEL_TRANSFER: "FUEL_TRANSFER",
  ALARM_TRIGGERED: "ALARM_TRIGGERED",
  ALARM_CLEARED: "ALARM_CLEARED",
  WORK_ORDER_ACTION: "WORK_ORDER_ACTION",
  CREW_CHANGE: "CREW_CHANGE",
  WATCH_CHANGE: "WATCH_CHANGE",
  MANUAL_ENTRY: "MANUAL_ENTRY",
  MOVEMENT: "MOVEMENT",
  REMARK: "REMARK",
  POSITION_FIX: "POSITION_FIX",
  WEATHER_OBSERVATION: "WEATHER_OBSERVATION",
  SAFETY_DRILL: "SAFETY_DRILL",
  INSPECTION: "INSPECTION",
  BUNKER_OPERATION: "BUNKER_OPERATION",
  ANCHORING: "ANCHORING",
  MOORING: "MOORING",
} as const;

export const DECK_LOG_EVENT_SOURCES = {
  TELEMETRY: "telemetry",
  MANUAL: "manual",
  WORK_ORDER: "work_order",
  ALERT: "alert",
  CREW: "crew",
  SYSTEM: "system",
} as const;

// ============================================================================
// ENGINE ROOM LOGBOOK
// ============================================================================

export const engineLogDaily = pgTable(
  "engine_log_daily",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
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
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    dailyLogId: varchar("daily_log_id").notNull().references(() => engineLogDaily.id, { onDelete: "cascade" }),
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
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    dailyLogId: varchar("daily_log_id").notNull().references(() => engineLogDaily.id, { onDelete: "cascade" }),
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
    uniqueGenHour: unique("uq_engine_log_gen_hour").on(table.dailyLogId, table.hour, table.generatorNumber),
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
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    dailyLogId: varchar("daily_log_id").notNull().references(() => engineLogDaily.id, { onDelete: "cascade" }),
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
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
    dayId: varchar("day_id").notNull().references(() => engineLogDaily.id, { onDelete: "cascade" }),
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

// ============================================================================
// AUTOFILL TABLES FOR DECK LOG
// ============================================================================

export const deckLogHourlyAutoFill = pgTable(
  "deck_log_hourly_autofill",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    hourlyLogId: varchar("hourly_log_id").notNull().references(() => deckLogHourly.id, { onDelete: "cascade" }),
    fieldName: text("field_name").notNull(),
    sourceType: text("source_type").notNull().default("telemetry"),
    sourceId: varchar("source_id"),
    rawValue: text("raw_value"),
    convertedValue: real("converted_value"),
    unit: text("unit"),
    confidence: real("confidence").default(1.0),
    appliedAt: timestamp("applied_at", { mode: "date" }).defaultNow(),
    overriddenAt: timestamp("overridden_at", { mode: "date" }),
    overriddenByUserId: varchar("overridden_by_user_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    hourlyLogIdx: index("idx_deck_log_autofill_hourly").on(table.hourlyLogId),
    fieldIdx: index("idx_deck_log_autofill_field").on(table.fieldName),
  })
);

export const insertDeckLogHourlyAutoFillSchema = createInsertSchema(deckLogHourlyAutoFill).omit({
  id: true,
  appliedAt: true,
  createdAt: true,
});

export type DeckLogHourlyAutoFill = typeof deckLogHourlyAutoFill.$inferSelect;
export type InsertDeckLogHourlyAutoFill = z.infer<typeof insertDeckLogHourlyAutoFillSchema>;

// ============================================================================
// FUEL EMISSIONS LOG
// ============================================================================

export const fuelEmissionsLog = pgTable(
  "fuel_emissions_log",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
    logDate: text("log_date").notNull(),
    fuelType: text("fuel_type").notNull(),
    consumptionMt: real("consumption_mt").notNull(),
    co2EmissionsMt: real("co2_emissions_mt"),
    sox_emissionsMt: real("sox_emissions_mt"),
    nox_emissionsMt: real("nox_emissions_mt"),
    distanceNm: real("distance_nm"),
    voyagePhase: text("voyage_phase"),
    eeoiValue: real("eeoi_value"),
    ciiRating: text("cii_rating"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_fuel_emissions_org").on(table.orgId),
    vesselDateIdx: index("idx_fuel_emissions_vessel_date").on(table.vesselId, table.logDate),
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
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
    timestamp: timestamp("timestamp", { mode: "date" }).notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    speedOverGround: real("speed_over_ground"),
    courseOverGround: real("course_over_ground"),
    heading: real("heading"),
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
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
    logDate: text("log_date").notNull(),
    equipmentId: varchar("equipment_id").references(() => equipment.id),
    equipmentName: text("equipment_name"),
    conditionScore: real("condition_score"),
    healthIndicator: text("health_indicator"),
    keyMetrics: jsonb("key_metrics").$type<Record<string, number>>(),
    alerts: jsonb("alerts").$type<string[]>(),
    recommendations: jsonb("recommendations").$type<string[]>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_condition_log_org").on(table.orgId),
    vesselDateIdx: index("idx_condition_log_vessel_date").on(table.vesselId, table.logDate),
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
