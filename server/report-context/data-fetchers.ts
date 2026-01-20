/**
 * Report Context Data Fetchers
 * 
 * Data fetching utilities for report context building.
 */

import { storage } from "../storage";
import type { WorkOrder, EquipmentTelemetry } from "@shared/schema-runtime";

export async function getVesselEquipment(vesselId: string): Promise<any[]> {
  const allEquipment = await storage.getEquipmentRegistry();
  return allEquipment.filter((e) => e.vesselId === vesselId);
}

export async function getVesselWorkOrders(
  vesselId: string,
  start: Date,
  end: Date
): Promise<WorkOrder[]> {
  const allOrders = await storage.getWorkOrders();
  return allOrders.filter(
    (wo) =>
      wo.vesselId === vesselId && new Date(wo.createdAt) >= start && new Date(wo.createdAt) <= end
  );
}

export async function getVesselTelemetry(
  vesselId: string,
  start: Date,
  end: Date
): Promise<EquipmentTelemetry[]> {
  const equipment = await getVesselEquipment(vesselId);
  const equipmentIds = equipment.map((e) => e.id);

  const allTelemetry = await storage.getLatestTelemetryReadings();
  return allTelemetry.filter(
    (t) =>
      equipmentIds.includes(t.equipmentId) && new Date(t.ts) >= start && new Date(t.ts) <= end
  );
}

export async function getVesselMaintenanceSchedules(vesselId: string): Promise<any[]> {
  const allSchedules = await storage.getMaintenanceSchedules();
  return allSchedules.filter((s) => s.vesselId === vesselId);
}

export async function getVesselAlerts(vesselId: string, start: Date, end: Date): Promise<any[]> {
  const equipment = await getVesselEquipment(vesselId);
  const equipmentIds = equipment.map((e) => e.id);

  const allAlerts = await storage.getAlertNotifications();
  return allAlerts.filter(
    (a) =>
      equipmentIds.includes(a.equipmentId) &&
      new Date(a.createdAt) >= start &&
      new Date(a.createdAt) <= end
  );
}

export async function getCrewCertifications(crewIds: string[]): Promise<any[]> {
  const allCerts = await storage.getCrewCertifications();
  return allCerts.filter((cert) => crewIds.includes(cert.crewId));
}

export async function getCrewRestSheets(vesselId: string, start: Date, end: Date): Promise<any[]> {
  const restData = await storage.getCrewRestByDateRange(
    vesselId,
    start.toISOString().split("T")[0],
    end.toISOString().split("T")[0]
  );
  return restData.map((r) => r.sheet);
}

export async function getComplianceLogs(start: Date, end: Date): Promise<any[]> {
  return storage.getComplianceAuditLog({
    startDate: start,
    endDate: end,
  });
}
