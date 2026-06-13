import { and, count, eq, inArray } from "drizzle-orm";
import { crew, shiftTemplate, vessels } from "@shared/schema-runtime";
import { db } from "../../../db";
import { createLogger } from "../../../lib/structured-logger";
import type { VesselSummary } from "../domain/read-models";

const logger = createLogger("SchedulePlannerReadModel");

export async function fetchVessels(orgId: string, vesselIds?: string[]): Promise<VesselSummary[]> {
  try {
    const conditions = [eq(vessels.orgId, orgId)];
    if (vesselIds?.length) {
      conditions.push(inArray(vessels.id, vesselIds));
    }

    const result = await db
      .select({
        id: vessels.id,
        name: vessels.name,
        active: vessels.active,
        condition: vessels.condition,
      })
      .from(vessels)
      .where(and(...conditions))
      .orderBy(vessels.name);

    return result.map((row) => ({
      id: row.id,
      name: row.name || "Unknown Vessel",
      requiredCrew: 0,
      currentCrew: 0,
      operationalStatus: (row.active ? "active" : "inactive") as
        | "active"
        | "maintenance"
        | "docked",
    }));
  } catch (error) {
    logger.warn("Failed to fetch vessels, returning empty list", { error });
    return [];
  }
}

export async function fetchCurrentCrewPerVessel(
  orgId: string
): Promise<{ vesselId: string; count: number }[]> {
  try {
    const result = await db
      .select({
        vesselId: crew.vesselId,
        count: count(),
      })
      .from(crew)
      .where(and(eq(crew.orgId, orgId), eq(crew.active, true)))
      .groupBy(crew.vesselId);

    return result
      .filter((r) => r.vesselId !== null)
      .map((r) => ({
        vesselId: r.vesselId!,
        count: Number(r.count),
      }));
  } catch (error) {
    logger.warn("Failed to fetch current crew per vessel", { error });
    return [];
  }
}

export async function fetchRequiredCrewPerVessel(
  orgId: string
): Promise<{ vesselId: string; count: number }[]> {
  try {
    const result = await db
      .select({
        vesselId: shiftTemplate.vesselId,
        count: count(),
      })
      .from(shiftTemplate)
      .where(eq(shiftTemplate.orgId, orgId))
      .groupBy(shiftTemplate.vesselId);

    return result
      .filter((r) => r.vesselId !== null)
      .map((r) => ({
        vesselId: r.vesselId!,
        count: Number(r.count),
      }));
  } catch (error) {
    logger.warn("Failed to fetch required crew per vessel", { error });
    return [];
  }
}
