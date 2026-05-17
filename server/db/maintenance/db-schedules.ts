/**
 * Maintenance - Database Storage Schedules & Records
 */

import { randomUUID } from "node:crypto";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { db } from "../../db-config";
import { maintenanceSchedules, maintenanceRecords, maintenanceCosts } from "@shared/schema-runtime";
import type {
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
  MaintenanceRecord,
  InsertMaintenanceRecord,
  MaintenanceCost,
  InsertMaintenanceCost,
} from "@shared/schema";
import type { MaintenanceFilters } from "./types.js";

export class DbMaintenanceSchedules {
  private validateOrgId(orgId: string | undefined, method: string): void {
    if (!orgId) {
      throw new Error(`[${method}] orgId is required`);
    }
  }

  async getMaintenanceSchedules(
    equipmentId?: string,
    orgId?: string,
    filters?: MaintenanceFilters
  ): Promise<MaintenanceSchedule[]> {
    const conditions: any[] = [];
    if (orgId) {
      conditions.push(eq(maintenanceSchedules.orgId, orgId));
    }
    if (equipmentId) {
      conditions.push(eq(maintenanceSchedules.equipmentId, equipmentId));
    }
    if (filters?.vesselId) {
      conditions.push(eq(maintenanceSchedules.vesselId, filters.vesselId));
    }
    if (filters?.status) {
      conditions.push(eq(maintenanceSchedules.status, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(gte(maintenanceSchedules.scheduledDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(maintenanceSchedules.scheduledDate, filters.endDate));
    }
    if (conditions.length > 0) {
      return db
        .select()
        .from(maintenanceSchedules)
        .where(and(...conditions))
        .orderBy(maintenanceSchedules.scheduledDate);
    }
    return db.select().from(maintenanceSchedules).orderBy(maintenanceSchedules.scheduledDate);
  }
  async getMaintenanceSchedule(
    id: string,
    orgId?: string
  ): Promise<MaintenanceSchedule | undefined> {
    const conditions = orgId
      ? and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.orgId, orgId))
      : eq(maintenanceSchedules.id, id);
    const [result] = await db.select().from(maintenanceSchedules).where(conditions);
    return result;
  }
  async createMaintenanceSchedule(
    schedule: InsertMaintenanceSchedule
  ): Promise<MaintenanceSchedule> {
    const [n] = await db
      .insert(maintenanceSchedules)
      .values({
        id: randomUUID(),
        ...schedule,
        status: schedule.status || "scheduled",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return n;
  }
  async updateMaintenanceSchedule(
    id: string,
    updates: Partial<InsertMaintenanceSchedule>,
    orgId?: string
  ): Promise<MaintenanceSchedule> {
    this.validateOrgId(orgId, "updateMaintenanceSchedule");
    const conditions = orgId
      ? and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.orgId, orgId))
      : eq(maintenanceSchedules.id, id);
    const [updated] = await db
      .update(maintenanceSchedules)
      .set({ ...updates, updatedAt: new Date() })
      .where(conditions)
      .returning();
    if (!updated) {
      throw new Error(`Maintenance schedule ${id} not found`);
    }
    return updated;
  }
  async deleteMaintenanceSchedule(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deleteMaintenanceSchedule");
    const conditions = orgId
      ? and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.orgId, orgId))
      : eq(maintenanceSchedules.id, id);
    await db.delete(maintenanceSchedules).where(conditions);
  }
  async getUpcomingSchedules(days: number = 30, orgId?: string): Promise<MaintenanceSchedule[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const conditions: any[] = [
      gte(maintenanceSchedules.scheduledDate, now),
      lte(maintenanceSchedules.scheduledDate, futureDate),
      sql`${maintenanceSchedules.status} != 'completed'`,
    ];
    if (orgId) {
      conditions.push(eq(maintenanceSchedules.orgId, orgId));
    }
    return db
      .select()
      .from(maintenanceSchedules)
      .where(and(...conditions))
      .orderBy(maintenanceSchedules.scheduledDate);
  }

  async getMaintenanceRecords(
    equipmentId?: string,
    orgId?: string,
    filters?: MaintenanceFilters
  ): Promise<MaintenanceRecord[]> {
    const conditions: any[] = [];
    if (orgId) {
      conditions.push(eq(maintenanceRecords.orgId, orgId));
    }
    if (equipmentId) {
      conditions.push(eq(maintenanceRecords.equipmentId, equipmentId));
    }
    if (conditions.length > 0) {
      return db
        .select()
        .from(maintenanceRecords)
        .where(and(...conditions))
        .orderBy(sql`${maintenanceRecords.createdAt} DESC`);
    }
    return db
      .select()
      .from(maintenanceRecords)
      .orderBy(sql`${maintenanceRecords.createdAt} DESC`);
  }
  async getMaintenanceRecord(id: string, orgId?: string): Promise<MaintenanceRecord | undefined> {
    const conditions = orgId
      ? and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.orgId, orgId))
      : eq(maintenanceRecords.id, id);
    const [result] = await db.select().from(maintenanceRecords).where(conditions);
    return result;
  }
  async createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    const [n] = await db
      .insert(maintenanceRecords)
      .values({ id: randomUUID(), ...record, createdAt: new Date(), updatedAt: new Date() } as any)
      .returning();
    return n;
  }
  async updateMaintenanceRecord(
    id: string,
    updates: Partial<InsertMaintenanceRecord>,
    orgId?: string
  ): Promise<MaintenanceRecord> {
    this.validateOrgId(orgId, "updateMaintenanceRecord");
    const conditions = orgId
      ? and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.orgId, orgId))
      : eq(maintenanceRecords.id, id);
    const [updated] = await db
      .update(maintenanceRecords)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(conditions)
      .returning();
    if (!updated) {
      throw new Error(`Maintenance record ${id} not found`);
    }
    return updated;
  }
  async deleteMaintenanceRecord(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deleteMaintenanceRecord");
    const conditions = orgId
      ? and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.orgId, orgId))
      : eq(maintenanceRecords.id, id);
    await db.delete(maintenanceRecords).where(conditions);
  }

  async getMaintenanceCosts(
    equipmentId?: string,
    orgId?: string,
    filters?: { startDate?: Date; endDate?: Date }
  ): Promise<MaintenanceCost[]> {
    const conditions: any[] = [];
    if (orgId) {
      conditions.push(eq(maintenanceCosts.orgId, orgId));
    }
    if (equipmentId) {
      conditions.push(eq(maintenanceCosts.equipmentId, equipmentId));
    }
    if (conditions.length > 0) {
      return db
        .select()
        .from(maintenanceCosts)
        .where(and(...conditions));
    }
    return db.select().from(maintenanceCosts);
  }
  async getMaintenanceCostsByWorkOrder(workOrderId: string): Promise<MaintenanceCost[]> {
    return db.select().from(maintenanceCosts).where(eq(maintenanceCosts.workOrderId, workOrderId));
  }
  async createMaintenanceCost(cost: InsertMaintenanceCost): Promise<MaintenanceCost> {
    const [n] = await db
      .insert(maintenanceCosts)
      .values({ id: randomUUID(), ...cost, createdAt: new Date(), updatedAt: new Date() } as any)
      .returning();
    return n;
  }
}
