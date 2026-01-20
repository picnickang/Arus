/**
 * Vessel Intelligence Data Fetchers
 * 
 * Functions to retrieve vessel-related data from storage.
 */

import type {
  EquipmentTelemetry,
  WorkOrder,
  MaintenanceSchedule,
} from "@shared/schema-runtime";
import type { IStorage } from "../storage";

export async function getWorkOrdersForVessel(
  storage: IStorage,
  vesselId: string,
  days?: number
): Promise<WorkOrder[]> {
  const allOrders = await storage.getWorkOrders();
  let vesselOrders = allOrders.filter((wo) => wo.vesselId === vesselId);

  if (days) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    vesselOrders = vesselOrders.filter((wo) => new Date(wo.createdAt) > cutoff);
  }

  return vesselOrders;
}

export async function getTelemetryForVessel(
  storage: IStorage,
  vesselId: string,
  days: number
): Promise<EquipmentTelemetry[]> {
  const equipment = await storage.getEquipmentRegistry();
  const vesselEquipment = equipment.filter((e) => e.vesselId === vesselId);
  const equipmentIds = vesselEquipment.map((e) => e.id);

  const allTelemetry = await storage.getLatestTelemetryReadings();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return allTelemetry.filter(
    (t) => equipmentIds.includes(t.equipmentId) && new Date(t.ts) > cutoff
  );
}

export async function getMaintenanceSchedulesForVessel(
  storage: IStorage,
  vesselId: string
): Promise<MaintenanceSchedule[]> {
  const allSchedules = await storage.getMaintenanceSchedules();
  return allSchedules.filter((s) => s.vesselId === vesselId);
}
