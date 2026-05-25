/**
 * Equipment Data Range Functions
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("AdaptiveTrainingWindow:DataRange");
import { workOrderService } from "../services/domains/work-order-service.js";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import { db } from "../db";
import { equipmentTelemetry } from "@shared/schema";
import { sql, eq, inArray, and } from "drizzle-orm";
import type { EquipmentDataRange } from "./types";

export async function getEquipmentDataRange(
  orgId: string,
  equipmentType?: string
): Promise<EquipmentDataRange> {
  const workOrders = await workOrderService.getWorkOrdersWithDetails(undefined, orgId);
  const equipmentList = await dbEquipmentStorage.getEquipmentRegistry(orgId);

  const relevantEquipment = equipmentType
    ? equipmentList.filter((eq) => eq.type === equipmentType)
    : equipmentList;

  if (relevantEquipment.length === 0) {
    return {
      equipmentType: equipmentType || "all",
      oldestTelemetryDate: null,
      availableDays: 0,
      failureCount: 0,
    };
  }

  const equipmentIds = relevantEquipment.map((eq) => eq.id);

  const failureCount = workOrders.filter((wo) => {
    const isRelevantEquipment = wo.equipmentId && equipmentIds.includes(wo.equipmentId);
    const isFailure = wo.maintenanceType === "corrective" || wo.priority === 1 || wo.priority === 2;
    return isRelevantEquipment && isFailure;
  }).length;

  let oldestDate: Date | null = null;

  try {
    logger.info("[Adaptive Training Window] Querying telemetry for equipment IDs:", { details: equipmentIds });

    const result = await db
      .select({ oldestTimestamp: sql<Date>`MIN(${equipmentTelemetry.ts})` })
      .from(equipmentTelemetry)
      .where(
        and(
          inArray(equipmentTelemetry.equipmentId, equipmentIds),
          eq(equipmentTelemetry.orgId, orgId)
        )
      )
      .execute();

    const first = result[0];
    if (first?.oldestTimestamp) {
      oldestDate = new Date(first.oldestTimestamp);
    }
  } catch (error) {
    logger.error("[Adaptive Training Window] Error fetching telemetry history:", undefined, error);
  }

  const availableDays = oldestDate
    ? Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    equipmentType: equipmentType || "all",
    oldestTelemetryDate: oldestDate,
    availableDays,
    failureCount,
  };
}
