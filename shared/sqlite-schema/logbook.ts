/**
 * SQLite Schema Logbook Module
 * Deck and Engine logbooks for maritime operations
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const deckLogDailySqlite = sqliteTable(
  "deck_log_daily",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    vesselId: text("vessel_id").notNull(),
    logDate: integer("log_date", { mode: "timestamp" }).notNull(),
    masterName: text("master_name"),
    chiefOfficerName: text("chief_officer_name"),
    departurePort: text("departure_port"),
    arrivalPort: text("arrival_port"),
    weatherConditions: text("weather_conditions"),
    seaState: text("sea_state"),
    windDirection: text("wind_direction"),
    windForce: integer("wind_force"),
    visibility: text("visibility"),
    barometer: real("barometer"),
    temperature: real("temperature"),
    remarks: text("remarks"),
    status: text("status").notNull().default("draft"),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
    version: integer("version").default(1),
    lastModifiedBy: text("last_modified_by"),
  },
  (table) => ({
    vesselDateIdx: index("idx_dld_vessel_date").on(table.vesselId, table.logDate),
    statusIdx: index("idx_dld_status").on(table.status),
  })
);

export const deckLogHourlySqlite = sqliteTable(
  "deck_log_hourly",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dailyLogId: text("daily_log_id").notNull(),
    hour: integer("hour").notNull(),
    course: real("course"),
    speed: real("speed"),
    distance: real("distance"),
    position: text("position"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    weather: text("weather"),
    seaState: text("sea_state"),
    windDirection: text("wind_direction"),
    windForce: integer("wind_force"),
    barometer: real("barometer"),
    temperature: real("temperature"),
    remarks: text("remarks"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    dailyLogHourIdx: index("idx_dlh_daily_log_hour").on(table.dailyLogId, table.hour),
  })
);

export const deckLogWatchSqlite = sqliteTable(
  "deck_log_watch",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dailyLogId: text("daily_log_id").notNull(),
    watchPeriod: text("watch_period").notNull(),
    officerOfWatch: text("officer_of_watch"),
    lookout: text("lookout"),
    helmsman: text("helmsman"),
    startTime: integer("start_time", { mode: "timestamp" }),
    endTime: integer("end_time", { mode: "timestamp" }),
    handoverNotes: text("handover_notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    dailyLogIdx: index("idx_dlw_daily_log").on(table.dailyLogId),
  })
);

export const deckLogEventsSqlite = sqliteTable(
  "deck_log_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dailyLogId: text("daily_log_id").notNull(),
    eventTime: integer("event_time", { mode: "timestamp" }).notNull(),
    eventType: text("event_type").notNull(),
    description: text("description"),
    position: text("position"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    relatedEquipmentId: text("related_equipment_id"),
    recordedBy: text("recorded_by"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    dailyLogEventIdx: index("idx_dle_daily_log_event").on(table.dailyLogId, table.eventTime),
    eventTypeIdx: index("idx_dle_event_type").on(table.eventType),
  })
);

export const deckLogHourlyAutoFillSqlite = sqliteTable(
  "deck_log_hourly_autofill",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    hourlyLogId: text("hourly_log_id").notNull(),
    dataSource: text("data_source").notNull(),
    autoFilledFields: text("auto_filled_fields"),
    confidence: real("confidence"),
    rawData: text("raw_data"),
    appliedAt: integer("applied_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    hourlyLogIdx: index("idx_dlha_hourly_log").on(table.hourlyLogId),
  })
);

export const engineLogDailySqlite = sqliteTable(
  "engine_log_daily",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    vesselId: text("vessel_id").notNull(),
    logDate: integer("log_date", { mode: "timestamp" }).notNull(),
    chiefEngineerName: text("chief_engineer_name"),
    secondEngineerName: text("second_engineer_name"),
    mainEngineRunningHours: real("main_engine_running_hours"),
    generatorHours: text("generator_hours"),
    fuelConsumption: text("fuel_consumption"),
    lubOilConsumption: text("lub_oil_consumption"),
    freshWaterProduction: real("fresh_water_production"),
    freshWaterConsumption: real("fresh_water_consumption"),
    seaWaterTemp: real("sea_water_temp"),
    engineRoomTemp: real("engine_room_temp"),
    remarks: text("remarks"),
    status: text("status").notNull().default("draft"),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
    version: integer("version").default(1),
    lastModifiedBy: text("last_modified_by"),
  },
  (table) => ({
    vesselDateIdx: index("idx_eld_vessel_date").on(table.vesselId, table.logDate),
    statusIdx: index("idx_eld_status").on(table.status),
  })
);

export const engineLogHourlySqlite = sqliteTable(
  "engine_log_hourly",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dailyLogId: text("daily_log_id").notNull(),
    hour: integer("hour").notNull(),
    mainEngineRpm: real("main_engine_rpm"),
    mainEngineLoad: real("main_engine_load"),
    mainEngineFuelRate: real("main_engine_fuel_rate"),
    exhaustTemp: text("exhaust_temp"),
    turbochargerRpm: real("turbocharger_rpm"),
    scavAirPressure: real("scav_air_pressure"),
    coolingWaterTemp: real("cooling_water_temp"),
    lubOilPressure: real("lub_oil_pressure"),
    lubOilTemp: real("lub_oil_temp"),
    generatorsOnline: text("generators_online"),
    powerOutput: real("power_output"),
    remarks: text("remarks"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    dailyLogHourIdx: index("idx_elh_daily_log_hour").on(table.dailyLogId, table.hour),
  })
);

export const engineLogGeneratorSqlite = sqliteTable(
  "engine_log_generator",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dailyLogId: text("daily_log_id").notNull(),
    generatorNumber: integer("generator_number").notNull(),
    runningHours: real("running_hours"),
    loadPercentage: real("load_percentage"),
    powerOutput: real("power_output"),
    fuelConsumption: real("fuel_consumption"),
    lubOilPressure: real("lub_oil_pressure"),
    coolingWaterTemp: real("cooling_water_temp"),
    exhaustTemp: real("exhaust_temp"),
    status: text("status"),
    remarks: text("remarks"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    dailyLogGenIdx: index("idx_elg_daily_log_gen").on(table.dailyLogId, table.generatorNumber),
  })
);

export const engineLogWatchSqlite = sqliteTable(
  "engine_log_watch",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dailyLogId: text("daily_log_id").notNull(),
    watchPeriod: text("watch_period").notNull(),
    engineerOfWatch: text("engineer_of_watch"),
    oiler: text("oiler"),
    startTime: integer("start_time", { mode: "timestamp" }),
    endTime: integer("end_time", { mode: "timestamp" }),
    roundsCompleted: integer("rounds_completed").default(0),
    abnormalitiesFound: integer("abnormalities_found", { mode: "boolean" }).default(false),
    handoverNotes: text("handover_notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    dailyLogIdx: index("idx_elw_daily_log").on(table.dailyLogId),
  })
);

export const engineLogEventsSqlite = sqliteTable(
  "engine_log_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dailyLogId: text("daily_log_id").notNull(),
    eventTime: integer("event_time", { mode: "timestamp" }).notNull(),
    eventType: text("event_type").notNull(),
    description: text("description"),
    equipmentId: text("equipment_id"),
    severity: text("severity"),
    actionTaken: text("action_taken"),
    recordedBy: text("recorded_by"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    dailyLogEventIdx: index("idx_elee_daily_log_event").on(table.dailyLogId, table.eventTime),
    eventTypeIdx: index("idx_elee_event_type").on(table.eventType),
  })
);
