import { pgTable, varchar, text, real, integer, timestamp, jsonb, index, sql } from "./base";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations } from "./core";
import { equipment } from "./equipment";
import { vessels } from "./vessels";

export const assetTwinTemplates = pgTable(
  "asset_twin_templates",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .references(() => organizations.id)
      .notNull(),
    equipmentType: text("equipment_type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    expectedBehavior: jsonb("expected_behavior").notNull(),
    operatingEnvelope: jsonb("operating_envelope").notNull(),
    sensorMappings: jsonb("sensor_mappings").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_asset_twin_templates_org").on(table.orgId),
    typeIdx: index("idx_asset_twin_templates_type").on(table.orgId, table.equipmentType),
  })
);

export const assetTwins = pgTable(
  "asset_twins",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .references(() => organizations.id)
      .notNull(),
    equipmentId: varchar("equipment_id")
      .references(() => equipment.id)
      .notNull(),
    templateId: varchar("template_id")
      .references(() => assetTwinTemplates.id)
      .notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    config: jsonb("config"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_asset_twins_org").on(table.orgId),
    equipIdx: index("idx_asset_twins_equip").on(table.orgId, table.equipmentId),
  })
);

export const assetTwinState = pgTable(
  "asset_twin_state",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .references(() => organizations.id)
      .notNull(),
    twinId: varchar("twin_id")
      .references(() => assetTwins.id)
      .notNull(),
    timestamp: timestamp("timestamp", { mode: "date" }).defaultNow(),
    observedValues: jsonb("observed_values").notNull(),
    expectedValues: jsonb("expected_values").notNull(),
    healthScore: real("health_score"),
    efficiencyScore: real("efficiency_score"),
    remainingUsefulLifeHours: real("remaining_useful_life_hours"),
    operatingContext: jsonb("operating_context"),
  },
  (table) => ({
    orgIdx: index("idx_asset_twin_state_org").on(table.orgId),
    twinIdx: index("idx_asset_twin_state_twin").on(table.twinId),
    tsIdx: index("idx_asset_twin_state_ts").on(table.twinId, table.timestamp),
  })
);

export const twinResiduals = pgTable(
  "twin_residuals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .references(() => organizations.id)
      .notNull(),
    twinId: varchar("twin_id")
      .references(() => assetTwins.id)
      .notNull(),
    timestamp: timestamp("timestamp", { mode: "date" }).defaultNow(),
    sensorType: text("sensor_type").notNull(),
    observed: real("observed").notNull(),
    expected: real("expected").notNull(),
    residual: real("residual").notNull(),
    zScore: real("z_score"),
    severity: text("severity").notNull().default("normal"),
  },
  (table) => ({
    orgIdx: index("idx_twin_residuals_org").on(table.orgId),
    twinIdx: index("idx_twin_residuals_twin").on(table.twinId),
    tsIdx: index("idx_twin_residuals_ts").on(table.twinId, table.timestamp),
    sevIdx: index("idx_twin_residuals_severity").on(table.twinId, table.severity),
  })
);

export const twinScenarios = pgTable(
  "twin_scenarios",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .references(() => organizations.id)
      .notNull(),
    twinId: varchar("twin_id")
      .references(() => assetTwins.id)
      .notNull(),
    name: text("name").notNull(),
    parameters: jsonb("parameters").notNull(),
    results: jsonb("results"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_twin_scenarios_org").on(table.orgId),
    twinIdx: index("idx_twin_scenarios_twin").on(table.twinId),
  })
);

export const twinEvents = pgTable(
  "twin_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .references(() => organizations.id)
      .notNull(),
    twinId: varchar("twin_id")
      .references(() => assetTwins.id)
      .notNull(),
    timestamp: timestamp("timestamp", { mode: "date" }).defaultNow(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload"),
    source: text("source"),
  },
  (table) => ({
    orgIdx: index("idx_twin_events_org").on(table.orgId),
    twinIdx: index("idx_twin_events_twin").on(table.twinId),
    tsIdx: index("idx_twin_events_ts").on(table.twinId, table.timestamp),
  })
);

// Push A3 — Vessel 3D Twin Viewer: glTF asset registry per vessel.
// Equipment-pin coordinates live in metadata, not hardcoded — works for any
// vessel owner's model. Files are stored on the application-owned filesystem
// and served through the auth-checked GET route (never publicly addressable).
export const vessel3dModels = pgTable(
  "vessel_3d_models",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .references(() => organizations.id)
      .notNull(),
    vesselId: varchar("vessel_id")
      .references(() => vessels.id)
      .notNull(),
    filename: text("filename").notNull(),
    mimetype: text("mimetype").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storedPath: text("stored_path").notNull(),
    // Array of { equipmentId: string; x: number; y: number; z: number; label?: string }
    equipmentPins: jsonb("equipment_pins").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_vessel_3d_models_org").on(table.orgId),
    vesselIdx: index("idx_vessel_3d_models_vessel").on(table.orgId, table.vesselId),
  })
);

export const equipmentPinSchema = z.object({
  equipmentId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  label: z.string().optional(),
});
export type EquipmentPin = z.infer<typeof equipmentPinSchema>;

export const insertVessel3dModelSchema = createInsertSchema(vessel3dModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Vessel3dModel = typeof vessel3dModels.$inferSelect;
export type InsertVessel3dModel = z.infer<typeof insertVessel3dModelSchema>;

export const insertAssetTwinTemplateSchema = createInsertSchema(assetTwinTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAssetTwinSchema = createInsertSchema(assetTwins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAssetTwinStateSchema = createInsertSchema(assetTwinState).omit({
  id: true,
});
export const insertTwinResidualSchema = createInsertSchema(twinResiduals).omit({
  id: true,
});
export const insertTwinScenarioSchema = createInsertSchema(twinScenarios).omit({
  id: true,
  createdAt: true,
});
export const insertTwinEventSchema = createInsertSchema(twinEvents).omit({
  id: true,
});

export type AssetTwinTemplate = typeof assetTwinTemplates.$inferSelect;
export type InsertAssetTwinTemplate = z.infer<typeof insertAssetTwinTemplateSchema>;
export type AssetTwin = typeof assetTwins.$inferSelect;
export type InsertAssetTwin = z.infer<typeof insertAssetTwinSchema>;
export type AssetTwinState = typeof assetTwinState.$inferSelect;
export type InsertAssetTwinState = z.infer<typeof insertAssetTwinStateSchema>;
export type TwinResidual = typeof twinResiduals.$inferSelect;
export type InsertTwinResidual = z.infer<typeof insertTwinResidualSchema>;
export type TwinScenario = typeof twinScenarios.$inferSelect;
export type InsertTwinScenario = z.infer<typeof insertTwinScenarioSchema>;
export type TwinEvent = typeof twinEvents.$inferSelect;
export type InsertTwinEvent = z.infer<typeof insertTwinEventSchema>;
