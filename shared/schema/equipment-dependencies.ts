/**
 * Task #82 — Admin-curated equipment dependency edges.
 *
 * Source-of-truth relational table backing the `DEPENDS_ON`
 * projection that powers `failurePropagation` (blast-radius reasoning).
 *
 * - One row = one directed edge (upstream → downstream).
 * - Scoped per-org and tagged with the vessel so the admin UI can
 *   filter quickly; nothing in the projector requires the vessel
 *   column — it's purely for the curation surface.
 * - `(orgId, upstreamEquipmentId, downstreamEquipmentId)` is unique
 *   so CSV bulk-import can't multiply-insert the same edge and the
 *   admin UI's "add" button is naturally idempotent.
 */

import {
  pgTable,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  unique,
  sql,
  createdAtOnly,
} from "./base";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations, users } from "./core";
import { equipment } from "./equipment";
import { vessels } from "./vessels";

export const equipmentDependencies = pgTable(
  "equipment_dependencies",
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
    upstreamEquipmentId: varchar("upstream_equipment_id")
      .references(() => equipment.id)
      .notNull(),
    downstreamEquipmentId: varchar("downstream_equipment_id")
      .references(() => equipment.id)
      .notNull(),
    notes: text("notes"),
    notesUpdatedBy: varchar("notes_updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    notesUpdatedAt: timestamp("notes_updated_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_equipment_deps_org").on(table.orgId),
    vesselIdx: index("idx_equipment_deps_vessel").on(table.orgId, table.vesselId),
    upstreamIdx: index("idx_equipment_deps_upstream").on(table.orgId, table.upstreamEquipmentId),
    uniqEdge: unique("uniq_equipment_deps_edge").on(
      table.orgId,
      table.upstreamEquipmentId,
      table.downstreamEquipmentId
    ),
  })
);

export const insertEquipmentDependencySchema = createInsertSchema(equipmentDependencies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  notesUpdatedBy: true,
  notesUpdatedAt: true,
});

export type EquipmentDependency = typeof equipmentDependencies.$inferSelect;
export type InsertEquipmentDependency = z.infer<typeof insertEquipmentDependencySchema>;

/**
 * Task #129 — Per-admin remembered layout for the dependency graph editor.
 *
 * One row per (orgId, userId, vesselId). `positions` is a JSONB map of
 * `equipmentId -> { x, y }`. We deliberately keep the whole layout in
 * one row so the debounced save is a single upsert and equipment that
 * has since been deleted simply becomes stale keys we ignore on load.
 *
 * Per-user rather than per-org so two admins arranging the same vessel
 * don't fight each other's layouts.
 */
export const equipmentDependencyLayouts = pgTable(
  "equipment_dependency_layouts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .references(() => organizations.id)
      .notNull(),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    vesselId: varchar("vessel_id")
      .references(() => vessels.id, { onDelete: "cascade" })
      .notNull(),
    positions: jsonb("positions").$type<Record<string, { x: number; y: number }>>().notNull(),
    ...createdAtOnly(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgUserVesselUniq: unique("uniq_equipment_dep_layout_user_vessel").on(
      table.orgId,
      table.userId,
      table.vesselId
    ),
    orgIdx: index("idx_equipment_dep_layout_org").on(table.orgId),
  })
);

export const equipmentDependencyLayoutPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const equipmentDependencyLayoutPositionsSchema = z.record(
  z.string().min(1),
  equipmentDependencyLayoutPositionSchema
);

export type EquipmentDependencyLayout = typeof equipmentDependencyLayouts.$inferSelect;
export type EquipmentDependencyLayoutPositions = z.infer<
  typeof equipmentDependencyLayoutPositionsSchema
>;
