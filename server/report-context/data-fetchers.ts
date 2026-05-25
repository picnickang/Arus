/**
 * Report Context Data Fetchers
 *
 * Data fetching utilities for report context building.
 */

import {
  dbEquipmentStorage,
  workOrderService,
  dbTelemetryStorage,
  dbMaintenanceStorage,
  dbAlertStorage,
  dbCrewExtensionsStorage,
  dbStcwStorage,
} from "../repositories";
import { db } from "../db-config";
import { sql } from "drizzle-orm";
import type { WorkOrder, EquipmentTelemetry } from "@shared/schema";

type EquipmentRow = Awaited<ReturnType<typeof dbEquipmentStorage.getEquipmentRegistry>>[number];
type WorkOrderRow = Awaited<ReturnType<typeof workOrderService.getWorkOrdersWithDetails>>[number];
type MaintenanceScheduleRow = Awaited<
  ReturnType<typeof dbMaintenanceStorage.getMaintenanceSchedules>
>[number];
type AlertNotificationRow = Awaited<
  ReturnType<typeof dbAlertStorage.getAlertNotifications>
>[number];
type CrewCertificationRow = Awaited<
  ReturnType<typeof dbCrewExtensionsStorage.getCrewCertifications>
>[number];

export async function getVesselEquipment(vesselId: string): Promise<EquipmentRow[]> {
  const allEquipment = await dbEquipmentStorage.getEquipmentRegistry();
  return allEquipment.filter((e) => e.vesselId === vesselId);
}

export async function getVesselWorkOrders(
  vesselId: string,
  start: Date,
  end: Date
): Promise<WorkOrder[]> {
  const allOrders = await workOrderService.getWorkOrdersWithDetails();
  return allOrders.filter(
    (wo: WorkOrderRow) =>
      wo.vesselId === vesselId && wo.createdAt != null && wo.createdAt >= start && wo.createdAt <= end
  );
}

export async function getVesselTelemetry(
  vesselId: string,
  start: Date,
  end: Date
): Promise<EquipmentTelemetry[]> {
  const equipment = await getVesselEquipment(vesselId);
  const equipmentIds = equipment.map((e) => e.id);

  const allTelemetry = await dbTelemetryStorage.getLatestTelemetryReadings();
  return allTelemetry.filter(
    (t) => equipmentIds.includes(t.equipmentId) && new Date(t.ts) >= start && new Date(t.ts) <= end
  );
}

export async function getVesselMaintenanceSchedules(
  vesselId: string
): Promise<MaintenanceScheduleRow[]> {
  const allSchedules = await dbMaintenanceStorage.getMaintenanceSchedules();
  return allSchedules.filter((s) => s.vesselId === vesselId);
}

export async function getVesselAlerts(
  vesselId: string,
  start: Date,
  end: Date
): Promise<AlertNotificationRow[]> {
  const equipment = await getVesselEquipment(vesselId);
  const equipmentIds = equipment.map((e) => e.id);

  const allAlerts = await dbAlertStorage.getAlertNotifications();
  return allAlerts.filter(
    (a: AlertNotificationRow) =>
      equipmentIds.includes(a.equipmentId) &&
      a.createdAt != null &&
      a.createdAt >= start &&
      a.createdAt <= end
  );
}

export async function getCrewCertifications(crewIds: string[]): Promise<CrewCertificationRow[]> {
  const allCerts = await dbCrewExtensionsStorage.getCrewCertifications();
  return allCerts.filter((cert: CrewCertificationRow) => crewIds.includes(cert.crewId));
}

export async function getCrewRestSheets(
  vesselId: string,
  start: Date,
  end: Date
): Promise<unknown[]> {
  const restData = await dbStcwStorage.getCrewRestRange(
    vesselId,
    start.toISOString().split("T")[0] ?? '',
    end.toISOString().split("T")[0] ?? ''
  );
  return (restData as object as { map?: (fn: (r: { sheet: unknown }) => unknown) => unknown[] }).map?.((r) => r.sheet) ?? [];
}

export async function getComplianceLogs(start: Date, end: Date): Promise<unknown[]> {
  const result = await db.execute(
    sql`SELECT * FROM compliance_audit_log WHERE created_at >= ${start.toISOString()}::timestamp AND created_at <= ${end.toISOString()}::timestamp ORDER BY created_at DESC`
  );
  return result.rows as object as unknown[];
}
