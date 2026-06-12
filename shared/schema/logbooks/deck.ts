/**
 * Deck logbook schema tables.
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
// DIGITAL DECK LOGBOOK
// ============================================================================

export const deckLogDaily = pgTable(
  "deck_log_daily",
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
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    dailyLogId: varchar("daily_log_id")
      .notNull()
      .references(() => deckLogDaily.id, { onDelete: "cascade" }),
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
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    dailyLogId: varchar("daily_log_id")
      .notNull()
      .references(() => deckLogDaily.id, { onDelete: "cascade" }),
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
      .references(() => deckLogDaily.id, { onDelete: "cascade" }),
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
