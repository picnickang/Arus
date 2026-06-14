/**
 * Equipment Service - Decommission Operations
 */

import type { InsertDecommissionEvent, EquipmentDecommissionEvent } from "@shared/schema";
import { logger } from "../../../utils/logger.js";
import { recordAndPublish } from "../../../sync-events";
import { DualWriteAdapter } from "../../../infrastructure/DualWriteAdapter";
import * as crud from "./crud-operations.js";
import { equipmentDecommissionRepository } from "../infrastructure/equipment-decommission-repository";

export interface DecommissionResult {
  event: EquipmentDecommissionEvent;
  equipment: {
    id: string;
    name: string;
    decommissionedAt: Date;
    decommissionStatus: string;
  };
}

export interface DecommissionedEquipmentWithEvent {
  equipment: {
    id: string;
    name: string;
    type: string;
    manufacturer: string | null;
    model: string | null;
    vesselName: string | null;
    purchaseValue: number | null;
    decommissionedAt: Date | null;
  };
  event: EquipmentDecommissionEvent | null;
}

export async function decommissionEquipment(
  adapter: DualWriteAdapter,
  equipmentId: string,
  orgId: string,
  data: InsertDecommissionEvent
): Promise<DecommissionResult> {
  const existingEquipment = await crud.getEquipmentById(adapter, equipmentId, orgId);
  if (!existingEquipment) {
    throw new Error("Equipment not found");
  }

  if (existingEquipment.decommissionedAt) {
    throw new Error("Equipment is already decommissioned");
  }

  const decommissionEvent = await equipmentDecommissionRepository.insertDecommissionEvent(
    orgId,
    equipmentId,
    data
  );

  const updatedEquipment = await equipmentDecommissionRepository.deactivateEquipment(
    orgId,
    equipmentId,
    data.reason,
    decommissionEvent.id
  );

  logger.info("EquipmentDecommission", `Equipment ${equipmentId} decommissioned: ${data.reason}`);

  await recordAndPublish("equipment", equipmentId, "update", {
    ...updatedEquipment,
    decommissioned: true,
    decommissionReason: data.reason,
  });

  return {
    event: decommissionEvent,
    equipment: {
      id: updatedEquipment.id,
      name: updatedEquipment.name,
      decommissionedAt: updatedEquipment.decommissionedAt!,
      decommissionStatus: updatedEquipment.decommissionStatus!,
    },
  };
}

export async function listDecommissionedEquipment(
  orgId: string
): Promise<DecommissionedEquipmentWithEvent[]> {
  return equipmentDecommissionRepository.listDecommissionedWithEvents(orgId);
}

export async function getDecommissionEvent(
  eventId: string,
  orgId: string
): Promise<EquipmentDecommissionEvent | undefined> {
  return equipmentDecommissionRepository.getDecommissionEventById(eventId, orgId);
}

export async function getEquipmentFinancialSummary(orgId: string): Promise<{
  totalFleetValue: number;
  totalBookValue: number;
  totalCapitalRecovered: number;
  activeEquipmentCount: number;
  decommissionedCount: number;
}> {
  const allEquipment = await equipmentDecommissionRepository.getEquipmentForFinancials(orgId);

  let decommissionEvents: { saleDetails: unknown }[] = [];
  try {
    decommissionEvents = await equipmentDecommissionRepository.getDecommissionSaleDetails(orgId);
  } catch (error) {
    logger.warn(
      "getEquipmentFinancialSummary",
      "Failed to fetch decommission events, using empty array",
      { error }
    );
  }

  let totalFleetValue = 0;
  let totalBookValue = 0;
  let activeEquipmentCount = 0;
  let decommissionedCount = 0;

  const now = new Date();
  const usefulLifeYears = 10;

  for (const eq of allEquipment) {
    if (eq.isActive && !eq.decommissionedAt) {
      activeEquipmentCount++;
      if (eq.purchaseValue) {
        totalFleetValue += eq.purchaseValue;
        if (eq.purchaseDate) {
          const purchaseDate =
            typeof eq.purchaseDate === "string" ? new Date(eq.purchaseDate) : eq.purchaseDate;
          const yearsOwned =
            (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          const depreciationRate = 1 / usefulLifeYears;
          const bookValue = eq.purchaseValue * (1 - Math.min(yearsOwned * depreciationRate, 1));
          totalBookValue += Math.max(0, bookValue);
        } else {
          totalBookValue += eq.purchaseValue;
        }
      }
    } else if (eq.decommissionedAt) {
      decommissionedCount++;
    }
  }

  let totalCapitalRecovered = 0;
  for (const event of decommissionEvents) {
    if (event.saleDetails && typeof event.saleDetails === "object") {
      const saleDetails = event.saleDetails as Record<string, unknown>;
      if (typeof saleDetails["salePrice"] === "number") {
        totalCapitalRecovered += saleDetails["salePrice"];
      }
    }
  }

  return {
    totalFleetValue,
    totalBookValue: Math.round(totalBookValue * 100) / 100,
    totalCapitalRecovered,
    activeEquipmentCount,
    decommissionedCount,
  };
}
