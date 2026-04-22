import {
  sql,
  pgTable,
  varchar,
  real,
  integer,
  timestamp,
  index,
  unique,
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";
import { equipment } from "./equipment";

export const equipmentFeatures = pgTable(
  "equipment_features",
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
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    meanTemp: real("mean_temp"),
    stdTemp: real("std_temp"),
    meanVibration: real("mean_vibration"),
    stdVibration: real("std_vibration"),
    meanPressure: real("mean_pressure"),
    stdPressure: real("std_pressure"),
    rmsVibration: real("rms_vibration"),
    peakToPeak: real("peak_to_peak"),
    kurtosis: real("kurtosis"),
    skewness: real("skewness"),
    windowMinutes: integer("window_minutes").default(60),
    sampleCount: integer("sample_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgEquipTimeIdx: index("idx_equip_features_org_equip_time").on(
      table.orgId,
      table.equipmentId,
      table.timestamp
    ),
    equipTimeIdx: index("idx_equip_features_equip_time").on(table.equipmentId, table.timestamp),
  })
);

export const fleetBaselines = pgTable(
  "fleet_baselines",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentType: varchar("equipment_type", { length: 100 }).notNull(),
    featureName: varchar("feature_name", { length: 100 }).notNull(),
    mean: real("mean").notNull(),
    stddev: real("stddev").notNull(),
    p5: real("p5"),
    p95: real("p95"),
    sampleSize: integer("sample_size").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgTypeFeatureIdx: index("idx_fleet_baselines_org_type_feature").on(
      table.orgId,
      table.equipmentType,
      table.featureName
    ),
    uniqueOrgTypeFeature: unique("uq_fleet_baselines_org_type_feature").on(
      table.orgId,
      table.equipmentType,
      table.featureName
    ),
  })
);

export const insertEquipmentFeatureSchema = createInsertSchema(equipmentFeatures).omit({
  id: true,
  createdAt: true,
});
export const insertFleetBaselineSchema = createInsertSchema(fleetBaselines).omit({
  id: true,
  computedAt: true,
});

export type EquipmentFeature = typeof equipmentFeatures.$inferSelect;
export type InsertEquipmentFeature = z.infer<typeof insertEquipmentFeatureSchema>;
export type FleetBaseline = typeof fleetBaselines.$inferSelect;
export type InsertFleetBaseline = z.infer<typeof insertFleetBaselineSchema>;
