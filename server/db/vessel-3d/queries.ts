/**
 * Storage queries for vessel 3D model metadata (routes/vessel-3d-routes.ts).
 * Lives under server/db so the route depends on the storage layer rather than
 * the raw db handle (hexagonal storage boundary). Queries are unchanged —
 * moved verbatim from the route. Disk I/O, quota, and path-guard logic stay in
 * the route.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db-config";
import { vessel3dModels, vessels, type EquipmentPin } from "@shared/schema-runtime";

export async function findVesselInOrg(
  vesselId: string,
  orgId: string
): Promise<{ id: string } | undefined> {
  const [vessel] = await db
    .select({ id: vessels.id })
    .from(vessels)
    .where(and(eq(vessels.id, vesselId), eq(vessels.orgId, orgId)));
  return vessel;
}

export interface InsertVessel3dModelInput {
  orgId: string;
  vesselId: string;
  filename: string;
  mimetype: string;
  sizeBytes: number;
  storedPath: string;
  equipmentPins: EquipmentPin[];
}

export async function insertVessel3dModel(values: InsertVessel3dModelInput) {
  const [row] = await db.insert(vessel3dModels).values(values).returning();
  return row;
}

export async function getLatestVessel3dModel(orgId: string, vesselId: string) {
  const [row] = await db
    .select()
    .from(vessel3dModels)
    .where(and(eq(vessel3dModels.orgId, orgId), eq(vessel3dModels.vesselId, vesselId)))
    .orderBy(desc(vessel3dModels.createdAt))
    .limit(1);
  return row;
}

export async function getVessel3dModelById(orgId: string, modelId: string) {
  const [row] = await db
    .select()
    .from(vessel3dModels)
    .where(and(eq(vessel3dModels.id, modelId), eq(vessel3dModels.orgId, orgId)));
  return row;
}

export async function updateVessel3dModelPins(
  orgId: string,
  modelId: string,
  pins: EquipmentPin[]
) {
  const [row] = await db
    .update(vessel3dModels)
    .set({ equipmentPins: pins, updatedAt: new Date() })
    .where(and(eq(vessel3dModels.id, modelId), eq(vessel3dModels.orgId, orgId)))
    .returning();
  return row;
}

export async function listVessel3dModels(orgId: string, vesselId: string) {
  return db
    .select()
    .from(vessel3dModels)
    .where(and(eq(vessel3dModels.orgId, orgId), eq(vessel3dModels.vesselId, vesselId)))
    .orderBy(desc(vessel3dModels.createdAt));
}

export async function promoteVessel3dModel(orgId: string, modelId: string, now: Date) {
  const [row] = await db
    .update(vessel3dModels)
    .set({ createdAt: now, updatedAt: now })
    .where(and(eq(vessel3dModels.id, modelId), eq(vessel3dModels.orgId, orgId)))
    .returning();
  return row;
}

export async function deleteVessel3dModel(orgId: string, modelId: string): Promise<void> {
  await db
    .delete(vessel3dModels)
    .where(and(eq(vessel3dModels.id, modelId), eq(vessel3dModels.orgId, orgId)));
}
