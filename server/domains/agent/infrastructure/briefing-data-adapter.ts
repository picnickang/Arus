import { db } from "../../../db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { alertNotifications, maintenanceSchedules } from "@shared/schema";
import { crewCertification, crew } from "@shared/schema/crew";
import type {
  BriefingDataPort,
  AlertRecord,
  MaintenanceDueRecord,
  ExpiringCertRecord,
  LowStockRecord,
} from "../domain/briefing-types";

export class BriefingDataAdapter implements BriefingDataPort {
  async getOvernightAlerts(orgId: string, periodStart: Date, periodEnd: Date): Promise<AlertRecord[]> {
    const alerts = await db.select({
      id: alertNotifications.id,
      equipmentId: alertNotifications.equipmentId,
      sensorType: alertNotifications.sensorType,
      alertType: alertNotifications.alertType,
      message: alertNotifications.message,
      value: alertNotifications.value,
      threshold: alertNotifications.threshold,
      createdAt: alertNotifications.createdAt,
    }).from(alertNotifications)
      .where(and(
        eq(alertNotifications.orgId, orgId),
        gte(alertNotifications.createdAt, periodStart),
        lte(alertNotifications.createdAt, periodEnd),
      ))
      .orderBy(desc(alertNotifications.createdAt))
      .limit(20);

    return alerts.map(a => ({
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

    const records = await db.select({
      id: maintenanceSchedules.id,
      equipmentId: maintenanceSchedules.equipmentId,
      scheduledDate: maintenanceSchedules.scheduledDate,
      maintenanceType: maintenanceSchedules.maintenanceType,
      description: maintenanceSchedules.description,
    }).from(maintenanceSchedules)
      .where(and(
        eq(maintenanceSchedules.orgId, orgId),
        eq(maintenanceSchedules.status, "scheduled"),
        lte(maintenanceSchedules.scheduledDate, todayEnd),
      ))
      .orderBy(maintenanceSchedules.scheduledDate)
      .limit(15);

    return records.map(r => ({
      id: r.id,
      equipmentId: r.equipmentId,
      scheduledDate: new Date(r.scheduledDate),
      maintenanceType: r.maintenanceType,
      description: r.description,
    }));
  }

  async getExpiringCertifications(orgId: string, withinDays: number): Promise<ExpiringCertRecord[]> {
    const futureDate = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);

    const records = await db.select({
      certId: crewCertification.id,
      crewId: crewCertification.crewId,
      cert: crewCertification.cert,
      expiresAt: crewCertification.expiresAt,
      crewName: crew.name,
    }).from(crewCertification)
      .innerJoin(crew, eq(crewCertification.crewId, crew.id))
      .where(and(
        eq(crewCertification.orgId, orgId),
        lte(crewCertification.expiresAt, futureDate),
        gte(crewCertification.expiresAt, new Date()),
      ))
      .orderBy(crewCertification.expiresAt)
      .limit(10);

    return records.map(r => ({
      certId: r.certId,
      crewId: r.crewId,
      cert: r.cert,
      expiresAt: new Date(r.expiresAt),
      crewName: r.crewName,
    }));
  }

  async getLowStockParts(orgId: string, limit: number): Promise<LowStockRecord[]> {
    const result = await db.execute(sql`
      SELECT id, part_name, quantity_on_hand, min_stock_level
      FROM parts_inventory
      WHERE org_id = ${orgId} AND quantity_on_hand <= min_stock_level
      ORDER BY quantity_on_hand ASC
      LIMIT ${limit}
    `);
    const rows = (result as { rows?: Array<Record<string, unknown>> }).rows || [];

    return rows.map(r => ({
      id: String(r.id),
      partName: String(r.part_name),
      quantityOnHand: Number(r.quantity_on_hand),
      minStockLevel: Number(r.min_stock_level),
    }));
  }
}
