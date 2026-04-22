import {
  dbAlertStorage,
  dbMaintenanceStorage,
  dbCrewExtensionsStorage,
  dbInventoryStorage,
} from "../../../repositories";
import type {
  BriefingDataPort,
  AlertRecord,
  MaintenanceDueRecord,
  ExpiringCertRecord,
  LowStockRecord,
} from "../domain/briefing-types";

export class BriefingDataAdapter implements BriefingDataPort {
  async getOvernightAlerts(
    orgId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<AlertRecord[]> {
    const allAlerts = await dbAlertStorage.getAlertNotifications(undefined, orgId);
    const filtered = allAlerts
      .filter(
        (a) =>
          a.createdAt && new Date(a.createdAt) >= periodStart && new Date(a.createdAt) <= periodEnd
      )
      .slice(0, 20);

    return filtered.map((a) => ({
      id: a.id,
      equipmentId: a.equipmentId,
      sensorType: a.sensorType,
      alertType: a.alertType,
      message: a.message,
      value: a.value,
      threshold: a.threshold,
      createdAt: a.createdAt,
    }));
  }

  async getMaintenanceDueToday(orgId: string): Promise<MaintenanceDueRecord[]> {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const scheduled = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId);
    const orgFiltered = scheduled.filter(
      (s) => (s as { orgId?: string }).orgId === orgId && new Date(s.scheduledDate) <= todayEnd
    );

    return orgFiltered.slice(0, 15).map((r) => ({
      id: r.id,
      equipmentId: r.equipmentId,
      scheduledDate: new Date(r.scheduledDate),
      maintenanceType: r.maintenanceType,
      description: r.description,
    }));
  }

  async getExpiringCertifications(
    orgId: string,
    withinDays: number
  ): Promise<ExpiringCertRecord[]> {
    const certs = await dbCrewExtensionsStorage.getCertificationsExpiring(orgId, withinDays, false);

    return certs.slice(0, 10).map((c) => ({
      certId: c.id,
      crewId: c.crewId,
      cert: c.cert,
      expiresAt: new Date(c.expiresAt),
      crewName: null,
    }));
  }

  async getLowStockParts(orgId: string, limit: number): Promise<LowStockRecord[]> {
    const parts = await dbInventoryStorage.getLowStockParts(orgId);

    return parts.slice(0, limit).map((p) => ({
      id: String(p.id),
      partName: p.partName || "Unknown Part",
      quantityOnHand: p.quantityOnHand ?? 0,
      minStockLevel: p.minStockLevel ?? 0,
    }));
  }
}
