/**
 * Storage queries for equipment dependencies + per-user dependency layouts
 * (routes/equipment-dependencies-routes.ts). Lives under server/db so the
 * route depends on the storage layer rather than the raw db handle (hexagonal
 * storage boundary). Queries unchanged — moved verbatim. Validation + graph
 * projection stay in the route.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db-config";
import {
  equipmentDependencies,
  equipmentDependencyLayouts,
  equipment,
  users,
  type EquipmentDependencyLayoutPositions,
} from "@shared/schema-runtime";

export async function findEquipmentInVessel(
  orgId: string,
  vesselId: string,
  equipmentIds: string[],
): Promise<{ id: string }[]> {
  return db
    .select({ id: equipment.id })
    .from(equipment)
    .where(
      and(
        eq(equipment.orgId, orgId),
        eq(equipment.vesselId, vesselId),
        inArray(equipment.id, equipmentIds),
      ),
    );
}

export async function listDependenciesWithEditor(orgId: string, vesselId: string) {
  return db
    .select({
      dep: equipmentDependencies,
      editorName: users.name,
      editorEmail: users.email,
    })
    .from(equipmentDependencies)
    .leftJoin(users, eq(users.id, equipmentDependencies.notesUpdatedBy))
    .where(
      and(
        eq(equipmentDependencies.orgId, orgId),
        eq(equipmentDependencies.vesselId, vesselId),
      ),
    );
}

export interface DependencyInsertInput {
  orgId: string;
  vesselId: string;
  upstreamEquipmentId: string;
  downstreamEquipmentId: string;
  notes: string | null;
}

export async function insertDependency(values: DependencyInsertInput) {
  const [row] = await db
    .insert(equipmentDependencies)
    .values(values)
    .onConflictDoNothing({
      target: [
        equipmentDependencies.orgId,
        equipmentDependencies.upstreamEquipmentId,
        equipmentDependencies.downstreamEquipmentId,
      ],
    })
    .returning();
  return row;
}

export async function insertDependenciesBatch(values: DependencyInsertInput[]) {
  return db
    .insert(equipmentDependencies)
    .values(values)
    .onConflictDoNothing({
      target: [
        equipmentDependencies.orgId,
        equipmentDependencies.upstreamEquipmentId,
        equipmentDependencies.downstreamEquipmentId,
      ],
    })
    .returning();
}

export async function updateDependencyNotes(
  orgId: string,
  id: string,
  set: { notes: string | null; notesUpdatedBy: string | null; notesUpdatedAt: Date; updatedAt: Date },
) {
  const [updated] = await db
    .update(equipmentDependencies)
    .set(set)
    .where(and(eq(equipmentDependencies.orgId, orgId), eq(equipmentDependencies.id, id)))
    .returning();
  return updated;
}

export async function getEditorNameEmail(userId: string) {
  const [editor] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId));
  return editor;
}

export async function deleteDependency(orgId: string, id: string) {
  const [removed] = await db
    .delete(equipmentDependencies)
    .where(and(eq(equipmentDependencies.orgId, orgId), eq(equipmentDependencies.id, id)))
    .returning();
  return removed;
}

export async function getDependencyLayout(orgId: string, userId: string, vesselId: string) {
  const [row] = await db
    .select()
    .from(equipmentDependencyLayouts)
    .where(
      and(
        eq(equipmentDependencyLayouts.orgId, orgId),
        eq(equipmentDependencyLayouts.userId, userId),
        eq(equipmentDependencyLayouts.vesselId, vesselId),
      ),
    );
  return row;
}

export async function upsertDependencyLayout(values: {
  orgId: string;
  userId: string;
  vesselId: string;
  positions: EquipmentDependencyLayoutPositions;
  updatedAt: Date;
}) {
  const [row] = await db
    .insert(equipmentDependencyLayouts)
    .values(values)
    .onConflictDoUpdate({
      target: [
        equipmentDependencyLayouts.orgId,
        equipmentDependencyLayouts.userId,
        equipmentDependencyLayouts.vesselId,
      ],
      set: { positions: values.positions, updatedAt: new Date() },
    })
    .returning();
  return row;
}
