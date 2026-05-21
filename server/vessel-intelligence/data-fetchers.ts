/**
 * Vessel Intelligence Data Fetchers
 *
 * Functions to retrieve vessel-related data from storage.
 */

import type { EquipmentTelemetry, WorkOrder, MaintenanceSchedule } from "@shared/schema";
import {
  dbEquipmentStorage,
  dbTelemetryStorage,
  dbMaintenanceStorage,
  workOrderService,
} from "../repositories";

export async function getWorkOrdersForVessel(
  vesselId: string,
  days?: number
): Promise<WorkOrder[]> {
  const allOrders = await workOrderService.getWorkOrdersWithDetails();
  let vesselOrders = allOrders.filter((wo) => wo.vesselId === vesselId);

  if (days) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    vesselOrders = vesselOrders.filter((wo) => new Date(wo.createdAt as string | Date) > cutoff);
  }

  return vesselOrders;
}

export async function getTelemetryForVessel(
  vesselId: string,
  days: number
): Promise<EquipmentTelemetry[]> {
  const equipment = await dbEquipmentStorage.getEquipmentRegistry();
  const vesselEquipment = equipment.filter((e) => e.vesselId === vesselId);
  const equipmentIds = vesselEquipment.map((e) => e.id);

  const allTelemetry = await dbTelemetryStorage.getLatestTelemetryReadings(
    undefined,
    500,
    undefined,
    undefined
  );
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return allTelemetry.filter(
    (t) => equipmentIds.includes(t.equipmentId) && new Date(t.ts) > cutoff
  );
}

export async function getMaintenanceSchedulesForVessel(
  vesselId: string
): Promise<MaintenanceSchedule[]> {
  const allSchedules = await dbMaintenanceStorage.getMaintenanceSchedules();
  return allSchedules.filter((s) => s.vesselId === vesselId);
}
