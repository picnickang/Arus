/**
 * Storage queries for the cross-vessel failure-pattern surface
 * (routes/equipment-cross-class-routes.ts). Lives under server/db/equipment
 * so the route depends on the storage layer rather than the raw db handle
 * (hexagonal storage boundary). Queries are unchanged — moved verbatim.
 */
import { and, eq, ne } from "drizzle-orm";
import { db } from "../../db-config";
import { equipment, vessels } from "@shared/schema-runtime";

export interface FocalEquipment {
  id: string;
  type: string;
  vesselId: string | null;
}

export async function findFocalEquipment(
  orgId: string,
  id: string,
): Promise<FocalEquipment | undefined> {
  const [row] = await db
    .select({ id: equipment.id, type: equipment.type, vesselId: equipment.vesselId })
    .from(equipment)
    .where(and(eq(equipment.orgId, orgId), eq(equipment.id, id)))
    .limit(1);
  return row;
}

export async function findVesselClass(
  orgId: string,
  vesselId: string,
): Promise<{ id: string; vesselClass: string | null } | undefined> {
  const [row] = await db
    .select({ id: vessels.id, vesselClass: vessels.vesselClass })
    .from(vessels)
    .where(and(eq(vessels.orgId, orgId), eq(vessels.id, vesselId)))
    .limit(1);
  return row;
}

export async function findPeerVesselIds(
  orgId: string,
  vesselClass: string,
  excludeVesselId: string,
): Promise<string[]> {
  const peers = await db
    .select({ id: vessels.id })
    .from(vessels)
    .where(
      and(
        eq(vessels.orgId, orgId),
        eq(vessels.vesselClass, vesselClass),
        ne(vessels.id, excludeVesselId),
      ),
    );
  return peers.map((p) => p.id);
}

export async function equipmentExistsInOrg(orgId: string, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(eq(equipment.orgId, orgId), eq(equipment.id, id)))
    .limit(1);
  return !!row;
}
