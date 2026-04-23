/**
 * DTC Work Order Handler
 */

import { dbEquipmentStorage, workOrderService } from "../repositories";
import type { DtcWithDefinition } from "./types";
import type { InsertWorkOrder } from "@shared/schema";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("DtcIntegration:WorkOrderHandler");

export async function hasRelatedOpenWorkOrder(
  equipmentId: string,
  priority: number,
  excludeReason?: string
): Promise<boolean> {
  const existingOrders = await workOrderService.getWorkOrdersWithDetails(equipmentId);
  return !!existingOrders.find(
    (wo) =>
      wo.status === "open" &&
      wo.priority &&
      wo.priority <= priority &&
      (!excludeReason || !wo.reason?.includes(excludeReason))
  );
}

export async function createWorkOrderFromDtc(
  dtc: DtcWithDefinition,
  orgId: string
): Promise<any | null> {
  if (!dtc.definition || dtc.definition.severity > 2) {
    return null;
  }

  const existingOrders = await workOrderService.getWorkOrdersWithDetails(dtc.equipmentId);
  const dtcWorkOrder = existingOrders.find(
    (wo) =>
      wo.status === "open" &&
      wo.reason?.includes(`SPN ${dtc.spn}`) &&
      wo.reason?.includes(`FMI ${dtc.fmi}`)
  );

  if (dtcWorkOrder) {
    logger.info(`[DTC Integration] Work order already exists for DTC SPN ${dtc.spn} FMI ${dtc.fmi}`);
    return null;
  }

  const eq = await dbEquipmentStorage.getEquipment(orgId, dtc.equipmentId);
  if (!eq) {
    logger.warn(`[DTC Integration] Equipment ${dtc.equipmentId} not found`);
    return null;
  }

  const priority = dtc.definition.severity === 1 ? 1 : 2;
  const affectsVesselDowntime = dtc.definition.severity === 1;
  const woNumber = await workOrderService.generateWorkOrderNumber(orgId);

  const workOrderData: InsertWorkOrder & { woNumber?: string } = {
    orgId,
    equipmentId: dtc.equipmentId,
    vesselId: eq.vesselId || undefined,
    status: "open",
    priority,
    reason: `DTC Fault: SPN ${dtc.spn} / FMI ${dtc.fmi}`,
    description: `${dtc.definition.description}\n\nAutomatic work order created due to ${priority === 1 ? "critical" : "high"} severity fault code detected.\n\nDevice: ${dtc.deviceId}\nOccurrence Count: ${dtc.oc}\nFirst Seen: ${dtc.firstSeen}\nLast Seen: ${dtc.lastSeen}`,
    affectsVesselDowntime,
    estimatedDowntimeHours: affectsVesselDowntime ? 4 : undefined,
    woNumber,
  };

  const newWorkOrder = await workOrderService.createWorkOrder(workOrderData);
  logger.info(`[DTC Integration] Created work order ${newWorkOrder.woNumber || newWorkOrder.id} for DTC SPN ${dtc.spn} FMI ${dtc.fmi}`);
  return newWorkOrder;
}
