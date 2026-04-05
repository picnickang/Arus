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
  dayRateSgd: numeric("day_rate_sgd", { precision: 10, scale: 2 }),
  downtimeDays: numeric("downtime_days", { precision: 10, scale: 2 }).default("0"),
  downtimeResetAt: timestamp("downtime_reset_at", { mode: "date" }),
  operationDays: numeric("operation_days", { precision: 10, scale: 2 }).default("0"),
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
export const portCall = pgTable("port_calls", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vesselId: varchar("vessel_id")
    .notNull()
    .references(() => vessels.id),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  portName: text("port_name").notNull(),
  portCode: text("port_code"),
  arrivalDate: timestamp("arrival_date", { mode: "date" }),
  departureDate: timestamp("departure_date", { mode: "date" }),
  purpose: text("purpose"),
  status: text("status").default("scheduled"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Drydock windows for maintenance planning
export const drydockWindow = pgTable("drydock_windows", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vesselId: varchar("vessel_id")
    .notNull()
    .references(() => vessels.id),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  endDate: timestamp("end_date", { mode: "date" }).notNull(),
  yardName: text("yard_name"),
  scope: text("scope"),
  status: text("status").default("planned"),
  estimatedCost: real("estimated_cost"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Insert schemas
export const insertVesselSchema = createInsertSchema(vessels)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().min(1).max(100),
    vesselType: z.string().optional(),
    condition: z.enum(["excellent", "good", "fair", "poor", "critical"]).optional(),
  });

export const insertWeatherCacheSchema = createInsertSchema(weatherCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortCallSchema = createInsertSchema(portCall).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrydockWindowSchema = createInsertSchema(drydockWindow).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
