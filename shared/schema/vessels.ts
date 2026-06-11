/**
 * Schema Vessels - Vessel Management and Weather
 *
 * Vessel registry, weather cache, port calls, and drydock windows.
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
  numeric,
  createInsertSchema,
  z,
  uuidPrimaryKey,
  timestamps,
  tenantColumn,
} from "./base";
import { organizations } from "./core";

// Vessels in the fleet - uses shared column builders to reduce duplication
export const vessels = pgTable("vessels", {
  ...uuidPrimaryKey(),
  ...tenantColumn(organizations),
  name: text("name").notNull(),
  imo: text("imo"),
  flag: text("flag"),
  vesselType: text("vessel_type"),
  vesselClass: text("vessel_class"),
  condition: text("condition").default("good"),
  onlineStatus: text("online_status").default("unknown"),
  lastHeartbeat: timestamp("last_heartbeat", { mode: "date" }),
  dwt: integer("dwt"),
  yearBuilt: integer("year_built"),
  active: boolean("active").default(true),
  notes: text("notes"),
  // mode:"number" added in 0049 — DB type unchanged (money/day
  // quantities stay numeric per the 0041 policy); consumers no longer
  // parse strings. Raw-sql aggregates (SUM(...)) still return strings —
  // cast ::float8 or wrap in Number() at that boundary.
  dayRateSgd: numeric("day_rate_sgd", { precision: 10, scale: 2, mode: "number" }),
  downtimeDays: numeric("downtime_days", { precision: 10, scale: 2, mode: "number" }).default(0),
  downtimeResetAt: timestamp("downtime_reset_at", { mode: "date" }),
  operationDays: numeric("operation_days", { precision: 10, scale: 2, mode: "number" }).default(0),
  operationResetAt: timestamp("operation_reset_at", { mode: "date" }),
  lastDailyUpdateDate: text("last_daily_update_date"),
  commissionDate: timestamp("commission_date", { mode: "date" }),
  schematicLayout: jsonb("schematic_layout"),
  ...timestamps(),
});

// Weather cache for adaptive thresholding
export const weatherCache = pgTable(
  "weather_cache",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    temperature: real("temperature"),
    humidity: real("humidity"),
    pressure: real("pressure"),
    windSpeed: real("wind_speed"),
    windDirection: real("wind_direction"),
    waveHeight: real("wave_height"),
    seaState: text("sea_state"),
    weatherCondition: text("weather_condition"),
    visibility: real("visibility"),
    alerts: jsonb("alerts"),
    rawData: jsonb("raw_data"),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow(),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    vesselIndex: index("idx_weather_cache_vessel").on(table.vesselId, table.fetchedAt),
    expiryIndex: index("idx_weather_cache_expiry").on(table.expiresAt),
  })
);

// Port calls for voyage tracking
export const portCall = pgTable("port_call", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  vesselId: varchar("vessel_id")
    .notNull()
    .references(() => vessels.id),
  port: text("port"),
  start: timestamp("start", { mode: "date" }),
  end: timestamp("end", { mode: "date" }),
  status: text("status"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Drydock windows for maintenance planning
export const drydockWindow = pgTable("drydock_window", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  vesselId: varchar("vessel_id")
    .notNull()
    .references(() => vessels.id),
  yard: text("yard"),
  start: timestamp("start", { mode: "date" }),
  end: timestamp("end", { mode: "date" }),
  workType: text("work_type"),
  status: text("status"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Insert schemas
export const insertVesselSchema = createInsertSchema(vessels)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().min(1).max(100),
    vesselType: z.string().optional(),
    condition: z.enum(["excellent", "good", "fair", "poor", "critical"]).optional(),
    // Columns are mode:"number" since 0049; coerce form/API strings at
    // the boundary ("" clears the rate to null).
    dayRateSgd: z.preprocess(
      (v) => (v === "" || v == null ? null : Number(v)),
      z.number().nonnegative().nullable()
    ).optional(),
    downtimeDays: z.coerce.number().nonnegative().optional(),
    operationDays: z.coerce.number().nonnegative().optional(),
  });

export const insertWeatherCacheSchema = createInsertSchema(weatherCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortCallSchema = createInsertSchema(portCall).omit({
  id: true,
  createdAt: true,
});

export const insertDrydockWindowSchema = createInsertSchema(drydockWindow).omit({
  id: true,
  createdAt: true,
});

// Types
export type Vessel = typeof vessels.$inferSelect;
export type InsertVessel = z.infer<typeof insertVesselSchema>;
export type WeatherCache = typeof weatherCache.$inferSelect;
export type InsertWeatherCache = z.infer<typeof insertWeatherCacheSchema>;
export type PortCall = typeof portCall.$inferSelect;
export type InsertPortCall = z.infer<typeof insertPortCallSchema>;
export type DrydockWindow = typeof drydockWindow.$inferSelect;
export type InsertDrydockWindow = z.infer<typeof insertDrydockWindowSchema>;
