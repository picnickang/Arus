/**
 * DTC Work Order Handler
 */

import type { IStorage } from "../storage";
import type { DtcWithDefinition } from "./types";
import type { InsertWorkOrder } from "@shared/schema-runtime";

export async function hasRelatedOpenWorkOrder(storage: IStorage, equipmentId: string, priority: number, excludeReason?: string): Promise<boolean> {
  const existingOrders = await storage.getWorkOrders(equipmentId);
  return !!existingOrders.find((wo) =>
    wo.status === "open" && wo.priority && wo.priority <= priority && (!excludeReason || !wo.reason?.includes(excludeReason))
  );
}

export async function createWorkOrderFromDtc(storage: IStorage, dtc: DtcWithDefinition, orgId: string): Promise<any | null> {
  if (!dtc.definition || dtc.definition.severity > 2) { return null; }

  const existingOrders = await storage.getWorkOrders(dtc.equipmentId);
  const dtcWorkOrder = existingOrders.find((wo) =>
    wo.status === "open" && wo.reason?.includes(`SPN ${dtc.spn}`) && wo.reason?.includes(`FMI ${dtc.fmi}`)
  );

  if (dtcWorkOrder) {
    console.log(`[DTC Integration] Work order already exists for DTC SPN ${dtc.spn} FMI ${dtc.fmi}`);
    return null;
  }

  const eq = await storage.getEquipment(orgId, dtc.equipmentId);
  if (!eq) {
    console.warn(`[DTC Integration] Equipment ${dtc.equipmentId} not found`);
    return null;
  }

  const priority = dtc.definition.severity === 1 ? 1 : 2;
  const affectsVesselDowntime = dtc.definition.severity === 1;
  const woNumber = await storage.generateWorkOrderNumber(orgId);

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

  const newWorkOrder = await storage.createWorkOrder(workOrderData);
  console.log(`[DTC Integration] Created work order ${newWorkOrder.woNumber || newWorkOrder.id} for DTC SPN ${dtc.spn} FMI ${dtc.fmi}`);
  return newWorkOrder;
}
