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
  index,
  unique,
  sql,
} from "./base";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations } from "./core";
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
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_equipment_deps_org").on(table.orgId),
    vesselIdx: index("idx_equipment_deps_vessel").on(table.orgId, table.vesselId),
    upstreamIdx: index("idx_equipment_deps_upstream").on(
      table.orgId,
      table.upstreamEquipmentId
    ),
    uniqEdge: unique("uniq_equipment_deps_edge").on(
      table.orgId,
      table.upstreamEquipmentId,
      table.downstreamEquipmentId
    ),
  })
);

export const insertEquipmentDependencySchema = createInsertSchema(
  equipmentDependencies
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EquipmentDependency = typeof equipmentDependencies.$inferSelect;
export type InsertEquipmentDependency = z.infer<
  typeof insertEquipmentDependencySchema
>;
