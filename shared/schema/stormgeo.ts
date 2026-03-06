/**
 * Schema StormGeo - Weather/Routing Integration Tables
 * 
 * StormGeo settings, snapshots, and import history for weather routing.
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

// StormGeo settings
export const stormgeoSettings = pgTable(
  "stormgeo_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    apiUrl: text("api_url"),
    apiKey: text("api_key"),
    clientId: text("client_id"),
    importMethod: text("import_method").default("file"),
    sftpHost: text("sftp_host"),
    sftpPort: integer("sftp_port").default(22),
    sftpUsername: text("sftp_username"),
    sftpPassword: text("sftp_password"),
    sftpPath: text("sftp_path"),
    autoSyncEnabled: boolean("auto_sync_enabled").default(false),
    syncIntervalMinutes: integer("sync_interval_minutes").default(60),
    lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
    lastSyncStatus: text("last_sync_status"),
    lastSyncError: text("last_sync_error"),
    autoFillDeckLog: boolean("auto_fill_deck_log").default(true),
    autoFillEngineLog: boolean("auto_fill_engine_log").default(false),
    preferredDataSource: text("preferred_data_source").default("stormgeo"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_stormgeo_settings_org").on(table.orgId),
    vesselIdIdx: index("idx_stormgeo_settings_vessel").on(table.vesselId),
    uniqueVessel: unique("uq_stormgeo_settings_vessel").on(table.orgId, table.vesselId),
  })
);

// StormGeo snapshots
export const stormgeoSnapshots = pgTable(
  "stormgeo_snapshots",
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
    snapshotType: text("snapshot_type").notNull(),
    sourceFile: text("source_file"),
    importMethod: text("import_method").notNull(),
    importedAt: timestamp("imported_at", { mode: "date" }).defaultNow(),
    voyageId: varchar("voyage_id"),
    routeId: varchar("route_id"),
    routeName: text("route_name"),
    departurePort: text("departure_port"),
    arrivalPort: text("arrival_port"),
    departureTime: timestamp("departure_time", { mode: "date" }),
    arrivalTime: timestamp("arrival_time", { mode: "date" }),
    latitude: real("latitude"),
    longitude: real("longitude"),
    forecastTime: timestamp("forecast_time", { mode: "date" }).notNull(),
    windSpeed: real("wind_speed"),
    windDirection: real("wind_direction"),
    windForceBeaufort: integer("wind_force_beaufort"),
    waveHeight: real("wave_height"),
    wavePeriod: real("wave_period"),
    waveDirection: real("wave_direction"),
    swellHeight: real("swell_height"),
    swellPeriod: real("swell_period"),
    swellDirection: real("swell_direction"),
    seaState: integer("sea_state"),
    currentSpeed: real("current_speed"),
    currentDirection: real("current_direction"),
    airTemperature: real("air_temperature"),
    seaTemperature: real("sea_temperature"),
    barometer: real("barometer"),
    humidity: real("humidity"),
    visibility: real("visibility"),
    precipitation: real("precipitation"),
    cloudCover: integer("cloud_cover"),
    skyCondition: text("sky_condition"),
    recommendedSpeed: real("recommended_speed"),
    recommendedCourse: real("recommended_course"),
    fuelConsumptionRate: real("fuel_consumption_rate"),
    etaAdjustmentHours: real("eta_adjustment_hours"),
    weatherAlerts: jsonb("weather_alerts"),
    rawData: jsonb("raw_data"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_stormgeo_snapshots_org").on(table.orgId),
    vesselIdIdx: index("idx_stormgeo_snapshots_vessel").on(table.vesselId),
    forecastTimeIdx: index("idx_stormgeo_snapshots_forecast").on(table.forecastTime),
    routeIdIdx: index("idx_stormgeo_snapshots_route").on(table.routeId),
    vesselForecastIdx: index("idx_stormgeo_snapshots_vessel_forecast").on(table.vesselId, table.forecastTime),
  })
);

// StormGeo import history
export const stormgeoImportHistory = pgTable(
  "stormgeo_import_history",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    importType: text("import_type").notNull(),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    fileHash: text("file_hash"),
    status: text("status").notNull(),
    recordsProcessed: integer("records_processed").default(0),
    recordsCreated: integer("records_created").default(0),
    recordsUpdated: integer("records_updated").default(0),
    recordsFailed: integer("records_failed").default(0),
    errorDetails: jsonb("error_details"),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    durationMs: integer("duration_ms"),
    initiatedBy: text("initiated_by"),
    initiatedByUserName: text("initiated_by_user_name"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_stormgeo_import_history_org").on(table.orgId),
    vesselIdIdx: index("idx_stormgeo_import_history_vessel").on(table.vesselId),
    statusIdx: index("idx_stormgeo_import_history_status").on(table.status),
    createdAtIdx: index("idx_stormgeo_import_history_created").on(table.createdAt),
    fileHashIdx: index("idx_stormgeo_import_history_hash").on(table.fileHash),
  })
);

// Insert schemas
export const insertStormgeoSettingsSchema = createInsertSchema(stormgeoSettings)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    importMethod: z.enum(["file", "api", "sftp"]).optional(),
    sftpPort: z.number().min(1).max(65535).optional(),
    syncIntervalMinutes: z.number().min(1).max(1440).optional(),
    preferredDataSource: z.enum(["stormgeo", "manual", "auto"]).optional(),
  });

export const insertStormgeoSnapshotSchema = createInsertSchema(stormgeoSnapshots)
  .omit({ id: true, createdAt: true, importedAt: true })
  .extend({
    snapshotType: z.string().min(1),
    importMethod: z.string().min(1),
  });

export const insertStormgeoImportHistorySchema = createInsertSchema(stormgeoImportHistory)
  .omit({ id: true, createdAt: true })
  .extend({
    importType: z.string().min(1),
    status: z.enum(["pending", "processing", "completed", "failed", "cancelled"]),
  });

// Types
export type StormgeoSettings = typeof stormgeoSettings.$inferSelect;
export type InsertStormgeoSettings = z.infer<typeof insertStormgeoSettingsSchema>;
export type StormgeoSnapshot = typeof stormgeoSnapshots.$inferSelect;
export type InsertStormgeoSnapshot = z.infer<typeof insertStormgeoSnapshotSchema>;
export type StormgeoImportHistory = typeof stormgeoImportHistory.$inferSelect;
export type InsertStormgeoImportHistory = z.infer<typeof insertStormgeoImportHistorySchema>;
