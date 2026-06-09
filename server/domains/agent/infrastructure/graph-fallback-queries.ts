/**
 * Infrastructure: relational fallback queries for the knowledge-graph Copilot
 * tools (tools/graph-tools.ts). When the AGE graph substrate is unavailable,
 * the tools answer the same questions via these relational JOINs. Holding the
 * raw `db` access here keeps the tool layer off the database handle (hexagonal
 * storage boundary). Query logic is unchanged — moved verbatim from the tools.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../db";
import { equipment, failureHistory, inventoryMovements, parts } from "@shared/schema-runtime";

export interface PeerFailureMode {
  failureMode: string | null;
  occurrences: number;
}

/** Relational equivalent of findSimilarFailures: failure modes seen across
 *  peer equipment of the same type. */
export async function findPeerFailureModes(
  orgId: string,
  equipmentId: string
): Promise<PeerFailureMode[]> {
  const [src] = await db
    .select({ type: equipment.type })
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
    .limit(1);
  if (!src?.type) {
    return [];
  }
  const peerIds = (
    await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(and(eq(equipment.type, src.type), eq(equipment.orgId, orgId)))
  ).map((r) => r.id);
  if (peerIds.length === 0) {
    return [];
  }
  return db
    .select({
      failureMode: failureHistory.failureMode,
      occurrences: sql<number>`count(*)::int`,
    })
    .from(failureHistory)
    .where(and(eq(failureHistory.orgId, orgId), inArray(failureHistory.equipmentId, peerIds)))
    .groupBy(failureHistory.failureMode)
    .orderBy(sql`count(*) DESC`)
    .limit(10);
}

export interface PartForFailureMode {
  partId: string | null;
  partName: string | null;
  occurrences: number;
}

/** Relational equivalent of whatPartsForFailureMode: forward-consumption
 *  movements ('reserve'/'consume') for work orders repairing this failure. */
export async function findPartsConsumedForFailureMode(
  orgId: string,
  failureMode: string
): Promise<PartForFailureMode[]> {
  const woIds = (
    await db
      .select({ id: failureHistory.workOrderId })
      .from(failureHistory)
      .where(and(eq(failureHistory.orgId, orgId), eq(failureHistory.failureMode, failureMode)))
  )
    .map((r) => r.id)
    .filter((id): id is string => !!id);
  if (woIds.length === 0) {
    return [];
  }
  return db
    .select({
      partId: inventoryMovements.partId,
      partName: parts.name,
      occurrences: sql<number>`count(*)::int`,
    })
    .from(inventoryMovements)
    .leftJoin(parts, eq(parts.id, inventoryMovements.partId))
    .where(
      and(
        eq(inventoryMovements.orgId, orgId),
        inArray(inventoryMovements.workOrderId, woIds),
        inArray(inventoryMovements.movementType, ["reserve", "consume"])
      )
    )
    .groupBy(inventoryMovements.partId, parts.name)
    .orderBy(sql`count(*) DESC`)
    .limit(25);
}
