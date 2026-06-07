/**
 * Vessel Diagram Registry Schema
 *
 * Versioned, tenant-scoped registry for Vessel Intelligence diagrams,
 * section maps, section polygons, thumbnail overrides, and publish validation.
 */

import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  unique,
  createInsertSchema,
  z,
  uuidPrimaryKey,
  timestamps,
  tenantColumn,
} from "./base";
import { organizations, users } from "./core";
import { vessels } from "./vessels";
import { equipment } from "./equipment";

export const vesselDiagramTypeValues = [
  "side_elevation",
  "deck_plan",
  "machinery_arrangement",
  "electrical_single_line",
  "fire_safety_plan",
  "system_schematic",
  "custom",
] as const;

export const vesselDiagramStatusValues = ["draft", "active", "archived"] as const;
export const vesselDiagramVersionStatusValues = [
  "uploaded",
  "active",
  "superseded",
  "rejected",
] as const;
export const vesselSectionMapStatusValues = ["draft", "published", "archived"] as const;
export const vesselThumbnailOwnerTypeValues = ["section", "equipment"] as const;
export const vesselValidationSeverityValues = ["blocker", "warning"] as const;

export const normalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const diagramViewBoxSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const validationSummarySchema = z.object({
  blockers: z.number().int().min(0),
  warnings: z.number().int().min(0),
  checkedAt: z.string(),
});

export type VesselDiagramType = (typeof vesselDiagramTypeValues)[number];
export type VesselDiagramStatus = (typeof vesselDiagramStatusValues)[number];
export type VesselDiagramVersionStatus = (typeof vesselDiagramVersionStatusValues)[number];
export type VesselSectionMapStatus = (typeof vesselSectionMapStatusValues)[number];
export type VesselValidationSeverity = (typeof vesselValidationSeverityValues)[number];
export type NormalizedPoint = z.infer<typeof normalizedPointSchema>;
export type DiagramViewBox = z.infer<typeof diagramViewBoxSchema>;
export type ValidationSummary = z.infer<typeof validationSummarySchema>;

export const vesselDiagrams = pgTable(
  "vessel_diagrams",
  {
    ...uuidPrimaryKey(),
    ...tenantColumn(organizations),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    diagramType: text("diagram_type").notNull().$type<VesselDiagramType>(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft").$type<VesselDiagramStatus>(),
    activeVersionId: varchar("active_version_id"),
    currentSectionMapId: varchar("current_section_map_id"),
    createdBy: varchar("created_by").references(() => users.id),
    updatedBy: varchar("updated_by").references(() => users.id),
    ...timestamps(),
  },
  (table) => ({
    orgVesselIndex: index("idx_vessel_diagrams_org_vessel").on(table.orgId, table.vesselId),
    typeIndex: index("idx_vessel_diagrams_type").on(table.orgId, table.vesselId, table.diagramType),
    uniqueTitlePerVessel: unique("uq_vessel_diagram_title_per_vessel").on(
      table.orgId,
      table.vesselId,
      table.title
    ),
  })
);

export const vesselDiagramVersions = pgTable(
  "vessel_diagram_versions",
  {
    ...uuidPrimaryKey(),
    ...tenantColumn(organizations),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    diagramId: varchar("diagram_id")
      .notNull()
      .references(() => vesselDiagrams.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: text("status").notNull().default("uploaded").$type<VesselDiagramVersionStatus>(),
    originalFileName: text("original_file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    contentSha256: varchar("content_sha256", { length: 64 }).notNull(),
    objectKey: text("object_key").notNull(),
    sanitizedSvg: text("sanitized_svg"),
    viewBox: jsonb("view_box").$type<DiagramViewBox>(),
    validationSummary: jsonb("validation_summary").$type<ValidationSummary>(),
    uploadedBy: varchar("uploaded_by").references(() => users.id),
    uploadedAt: timestamp("uploaded_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    diagramIndex: index("idx_vessel_diagram_versions_diagram").on(table.orgId, table.diagramId),
    vesselIndex: index("idx_vessel_diagram_versions_vessel").on(table.orgId, table.vesselId),
    uniqueVersion: unique("uq_vessel_diagram_version").on(table.diagramId, table.versionNumber),
  })
);

export const vesselSectionMaps = pgTable(
  "vessel_section_maps",
  {
    ...uuidPrimaryKey(),
    ...tenantColumn(organizations),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    diagramId: varchar("diagram_id").references(() => vesselDiagrams.id, { onDelete: "set null" }),
    diagramVersionId: varchar("diagram_version_id").references(() => vesselDiagramVersions.id, {
      onDelete: "set null",
    }),
    sourceMapId: varchar("source_map_id"),
    name: text("name").notNull(),
    coordinateMode: text("coordinate_mode").notNull().default("normalized_percent"),
    diagramWidth: integer("diagram_width").notNull().default(895),
    diagramHeight: integer("diagram_height").notNull().default(420),
    diagramKind: text("diagram_kind")
      .notNull()
      .default("side_elevation")
      .$type<VesselDiagramType>(),
    status: text("status").notNull().default("draft").$type<VesselSectionMapStatus>(),
    validationSummary: jsonb("validation_summary").$type<ValidationSummary>(),
    publishedAt: timestamp("published_at", { mode: "date" }),
    publishedBy: varchar("published_by").references(() => users.id),
    createdBy: varchar("created_by").references(() => users.id),
    updatedBy: varchar("updated_by").references(() => users.id),
    ...timestamps(),
  },
  (table) => ({
    orgVesselIndex: index("idx_vessel_section_maps_org_vessel").on(table.orgId, table.vesselId),
    diagramIndex: index("idx_vessel_section_maps_diagram").on(table.orgId, table.diagramId),
  })
);

export const vesselSections = pgTable(
  "vessel_sections",
  {
    ...uuidPrimaryKey(),
    ...tenantColumn(organizations),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    mapId: varchar("map_id")
      .notNull()
      .references(() => vesselSectionMaps.id, { onDelete: "cascade" }),
    sectionKey: varchar("section_key", { length: 120 }).notNull(),
    sectionNo: integer("section_no").notNull(),
    name: text("name").notNull(),
    color: varchar("color", { length: 24 }).notNull(),
    thumbnailFallback: text("thumbnail_fallback"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (table) => ({
    mapIndex: index("idx_vessel_sections_map").on(table.orgId, table.mapId),
    uniqueKeyPerMap: unique("uq_vessel_section_key_per_map").on(table.mapId, table.sectionKey),
    uniqueNumberPerMap: unique("uq_vessel_section_number_per_map").on(table.mapId, table.sectionNo),
  })
);

export const vesselSectionPolygons = pgTable(
  "vessel_section_polygons",
  {
    ...uuidPrimaryKey(),
    ...tenantColumn(organizations),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    mapId: varchar("map_id")
      .notNull()
      .references(() => vesselSectionMaps.id, { onDelete: "cascade" }),
    sectionId: varchar("section_id")
      .notNull()
      .references(() => vesselSections.id, { onDelete: "cascade" }),
    pointsNormalized: jsonb("points_normalized").notNull().$type<NormalizedPoint[]>(),
    labelNormalized: jsonb("label_normalized").notNull().$type<NormalizedPoint>(),
    isDraft: boolean("is_draft").notNull().default(true),
    ...timestamps(),
  },
  (table) => ({
    sectionIndex: index("idx_vessel_section_polygons_section").on(table.orgId, table.sectionId),
  })
);

export const vesselSectionEquipmentAssignments = pgTable(
  "vessel_section_equipment_assignments",
  {
    ...uuidPrimaryKey(),
    ...tenantColumn(organizations),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    mapId: varchar("map_id")
      .notNull()
      .references(() => vesselSectionMaps.id, { onDelete: "cascade" }),
    sectionId: varchar("section_id")
      .notNull()
      .references(() => vesselSections.id, { onDelete: "cascade" }),
    equipmentId: varchar("equipment_id").references(() => equipment.id, { onDelete: "set null" }),
    equipmentName: text("equipment_name").notNull(),
    assetCode: text("asset_code"),
    system: text("system"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: varchar("created_by").references(() => users.id),
    ...timestamps(),
  },
  (table) => ({
    sectionIndex: index("idx_vessel_section_equipment_section").on(table.orgId, table.sectionId),
    equipmentIndex: index("idx_vessel_section_equipment_equipment").on(
      table.orgId,
      table.equipmentId
    ),
  })
);

export const vesselThumbnailOverrides = pgTable(
  "vessel_thumbnail_overrides",
  {
    ...uuidPrimaryKey(),
    ...tenantColumn(organizations),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    ownerType: text("owner_type")
      .notNull()
      .$type<(typeof vesselThumbnailOwnerTypeValues)[number]>(),
    ownerId: varchar("owner_id").notNull(),
    mapId: varchar("map_id").references(() => vesselSectionMaps.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    originalFileName: text("original_file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    contentSha256: varchar("content_sha256", { length: 64 }).notNull(),
    fallbackMode: text("fallback_mode").notNull().default("manual"),
    updatedBy: varchar("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    ...timestamps(),
  },
  (table) => ({
    ownerIndex: index("idx_vessel_thumbnail_owner").on(
      table.orgId,
      table.vesselId,
      table.ownerType,
      table.ownerId
    ),
  })
);

export const vesselDiagramValidationResults = pgTable(
  "vessel_diagram_validation_results",
  {
    ...uuidPrimaryKey(),
    ...tenantColumn(organizations),
    vesselId: varchar("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    diagramId: varchar("diagram_id").references(() => vesselDiagrams.id, { onDelete: "cascade" }),
    diagramVersionId: varchar("diagram_version_id").references(() => vesselDiagramVersions.id, {
      onDelete: "cascade",
    }),
    mapId: varchar("map_id").references(() => vesselSectionMaps.id, { onDelete: "cascade" }),
    severity: text("severity").notNull().$type<VesselValidationSeverity>(),
    code: varchar("code", { length: 120 }).notNull(),
    message: text("message").notNull(),
    path: text("path"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    mapIndex: index("idx_vessel_validation_map").on(table.orgId, table.mapId),
    versionIndex: index("idx_vessel_validation_version").on(table.orgId, table.diagramVersionId),
  })
);

export const insertVesselDiagramSchema = createInsertSchema(vesselDiagrams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertVesselDiagramVersionSchema = createInsertSchema(vesselDiagramVersions).omit({
  id: true,
  uploadedAt: true,
});
export const insertVesselSectionMapSchema = createInsertSchema(vesselSectionMaps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertVesselSectionSchema = createInsertSchema(vesselSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertVesselSectionPolygonSchema = createInsertSchema(vesselSectionPolygons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VesselDiagram = typeof vesselDiagrams.$inferSelect;
export type InsertVesselDiagram = typeof vesselDiagrams.$inferInsert;
export type VesselDiagramVersion = typeof vesselDiagramVersions.$inferSelect;
export type InsertVesselDiagramVersion = typeof vesselDiagramVersions.$inferInsert;
export type VesselSectionMap = typeof vesselSectionMaps.$inferSelect;
export type InsertVesselSectionMap = typeof vesselSectionMaps.$inferInsert;
export type VesselSection = typeof vesselSections.$inferSelect;
export type InsertVesselSection = typeof vesselSections.$inferInsert;
export type VesselSectionPolygon = typeof vesselSectionPolygons.$inferSelect;
export type InsertVesselSectionPolygon = typeof vesselSectionPolygons.$inferInsert;
export type VesselSectionEquipmentAssignment =
  typeof vesselSectionEquipmentAssignments.$inferSelect;
export type VesselThumbnailOverride = typeof vesselThumbnailOverrides.$inferSelect;
export type VesselDiagramValidationResult = typeof vesselDiagramValidationResults.$inferSelect;
