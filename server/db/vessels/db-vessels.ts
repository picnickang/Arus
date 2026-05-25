/**
 * Vessels - Database Storage
 */

import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db-config";
import {
  vessels,
  portCall as portCallTable,
  drydockWindow as drydockWindowTable,
} from "@shared/schema-runtime";
import type {
  Vessel,
  InsertVessel,
  PortCall,
  InsertPortCall,
  DrydockWindow,
  InsertDrydockWindow,
} from "@shared/schema";
import type { FleetOverview } from "./types.js";

export class DatabaseVesselStorage {
  private validateOrgId(orgId: string | undefined, method: string): void {
    if (!orgId) {
      throw new Error(`[${method}] orgId is required`);
    }
  }

  async getVessels(orgId?: string): Promise<Vessel[]> {
    if (orgId) {
      return db.select().from(vessels).where(eq(vessels.orgId, orgId)).orderBy(vessels.name);
    }
    return db.select().from(vessels).orderBy(vessels.name);
  }
  async getVesselsPaginated(
    orgId: string | undefined,
    limit: number,
    offset: number
  ): Promise<{ items: Vessel[]; total: number }> {
    const countQuery = db.select({ count: sql<number>`count(*)` }).from(vessels);
    const countResult = orgId ? await countQuery.where(eq(vessels.orgId, orgId)) : await countQuery;
    const total = Number(countResult[0]?.count ?? 0);
    const query = db.select().from(vessels).orderBy(vessels.name).limit(limit).offset(offset);
    const items = orgId ? await query.where(eq(vessels.orgId, orgId)) : await query;
    return { items, total };
  }
  async getVessel(id: string, orgId?: string): Promise<Vessel | undefined> {
    const conditions = orgId
      ? and(eq(vessels.id, id), eq(vessels.orgId, orgId))
      : eq(vessels.id, id);
    const [result] = await db.select().from(vessels).where(conditions);
    return result;
  }
  async getVesselByName(name: string, orgId: string): Promise<Vessel | undefined> {
    this.validateOrgId(orgId, "getVesselByName");
    const [result] = await db
      .select()
      .from(vessels)
      .where(and(eq(vessels.name, name), eq(vessels.orgId, orgId)));
    return result;
  }
  async createVessel(vesselData: InsertVessel): Promise<Vessel> {
    const [n] = await db
      .insert(vessels)
      .values({ id: randomUUID(), ...vesselData, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    if (!n) throw new Error("Failed to create vessel");
    return n;
  }
  async updateVessel(id: string, updates: Partial<InsertVessel>, orgId?: string): Promise<Vessel> {
    this.validateOrgId(orgId, "updateVessel");
    const conditions = orgId
      ? and(eq(vessels.id, id), eq(vessels.orgId, orgId))
      : eq(vessels.id, id);
    const [updated] = await db
      .update(vessels)
      .set({ ...updates, updatedAt: new Date() })
      .where(conditions)
      .returning();
    if (!updated) {
      throw new Error(`Vessel ${id} not found`);
    }
    return updated;
  }
  async deleteVessel(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deleteVessel");
    const conditions = orgId
      ? and(eq(vessels.id, id), eq(vessels.orgId, orgId))
      : eq(vessels.id, id);
    await db.delete(vessels).where(conditions);
  }

  async getFleetOverview(orgId?: string): Promise<FleetOverview> {
    const list = await this.getVessels(orgId);
    const vesselsByStatus: Record<string, number> = {};
    let activeVessels = 0;
    for (const v of list) {
      const status = (v as { status?: string }).status ?? "unknown";
      vesselsByStatus[status] = (vesselsByStatus[status] ?? 0) + 1;
      if (status === "active" || status === "operational") {
        activeVessels++;
      }
    }
    return { totalVessels: list.length, activeVessels, vesselsByStatus };
  }

  async getPortCalls(vesselId: string, orgId: string): Promise<PortCall[]> {
    this.validateOrgId(orgId, "getPortCalls");
    return db
      .select()
      .from(portCallTable)
      .where(and(eq(portCallTable.vesselId, vesselId), eq(portCallTable.orgId, orgId)))
      .orderBy(sql`${portCallTable.start} DESC`);
  }
  async getAllPortCalls(orgId?: string): Promise<PortCall[]> {
    return orgId
      ? db
          .select()
          .from(portCallTable)
          .where(eq(portCallTable.orgId, orgId))
          .orderBy(sql`${portCallTable.start} DESC`)
      : db
          .select()
          .from(portCallTable)
          .orderBy(sql`${portCallTable.start} DESC`);
  }
  async createPortCall(portCallData: InsertPortCall): Promise<PortCall> {
    const [n] = await db
      .insert(portCallTable)
      .values({ id: randomUUID(), ...portCallData, createdAt: new Date() })
      .returning();
    if (!n) throw new Error("Failed to create port call");
    return n;
  }
  async updatePortCall(
    id: string,
    updates: Partial<InsertPortCall>,
    orgId: string
  ): Promise<PortCall> {
    this.validateOrgId(orgId, "updatePortCall");
    const [updated] = await db
      .update(portCallTable)
      .set({ ...updates })
      .where(and(eq(portCallTable.id, id), eq(portCallTable.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error(`Port call ${id} not found`);
    }
    return updated;
  }
  async deletePortCall(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deletePortCall");
    await db
      .delete(portCallTable)
      .where(and(eq(portCallTable.id, id), eq(portCallTable.orgId, orgId)));
  }

  async getDrydockWindows(vesselId: string, orgId: string): Promise<DrydockWindow[]> {
    this.validateOrgId(orgId, "getDrydockWindows");
    return db
      .select()
      .from(drydockWindowTable)
      .where(and(eq(drydockWindowTable.vesselId, vesselId), eq(drydockWindowTable.orgId, orgId)))
      .orderBy(sql`${drydockWindowTable.start} DESC`);
  }
  async getAllDrydockWindows(orgId?: string): Promise<DrydockWindow[]> {
    return orgId
      ? db
          .select()
          .from(drydockWindowTable)
          .where(eq(drydockWindowTable.orgId, orgId))
          .orderBy(sql`${drydockWindowTable.start} DESC`)
      : db
          .select()
          .from(drydockWindowTable)
          .orderBy(sql`${drydockWindowTable.start} DESC`);
  }
  async createDrydockWindow(window: InsertDrydockWindow): Promise<DrydockWindow> {
    const [n] = await db
      .insert(drydockWindowTable)
      .values({ id: randomUUID(), ...window, createdAt: new Date() })
      .returning();
    if (!n) throw new Error("Failed to create drydock window");
    return n;
  }
  async updateDrydockWindow(
    id: string,
    updates: Partial<InsertDrydockWindow>,
    orgId: string
  ): Promise<DrydockWindow> {
    this.validateOrgId(orgId, "updateDrydockWindow");
    const [updated] = await db
      .update(drydockWindowTable)
      .set({ ...updates })
      .where(and(eq(drydockWindowTable.id, id), eq(drydockWindowTable.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error(`Drydock window ${id} not found`);
    }
    return updated;
  }
  async deleteDrydockWindow(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deleteDrydockWindow");
    await db
      .delete(drydockWindowTable)
      .where(and(eq(drydockWindowTable.id, id), eq(drydockWindowTable.orgId, orgId)));
  }
}
