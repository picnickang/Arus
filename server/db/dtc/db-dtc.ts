/**
 * DTC - Database Storage
 */

import { eq, and, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../../db-config";
import { dtcDefinitions, dtcFaults } from "@shared/schema-runtime";
import type { DtcDefinition, InsertDtcDefinition, DtcFault, InsertDtcFault } from "@shared/schema";

export class DatabaseDtcStorage {
  async getDtcDefinitions(
    spn?: number,
    fmi?: number,
    manufacturer?: string
  ): Promise<DtcDefinition[]> {
    const conditions = [];
    if (spn !== undefined) {
      conditions.push(eq(dtcDefinitions.spn, spn));
    }
    if (fmi !== undefined) {
      conditions.push(eq(dtcDefinitions.fmi, fmi));
    }
    if (manufacturer !== undefined) {
      conditions.push(eq(dtcDefinitions.manufacturer, manufacturer));
    }
    if (conditions.length === 0) {
      return db.select().from(dtcDefinitions).orderBy(dtcDefinitions.spn, dtcDefinitions.fmi);
    }
    return db
      .select()
      .from(dtcDefinitions)
      .where(and(...conditions))
      .orderBy(dtcDefinitions.spn, dtcDefinitions.fmi);
  }
  async getDtcDefinition(
    spn: number,
    fmi: number,
    manufacturer: string = ""
  ): Promise<DtcDefinition | undefined> {
    const [result] = await db
      .select()
      .from(dtcDefinitions)
      .where(
        and(
          eq(dtcDefinitions.spn, spn),
          eq(dtcDefinitions.fmi, fmi),
          eq(dtcDefinitions.manufacturer, manufacturer)
        )
      );
    return result;
  }
  async createDtcDefinition(def: InsertDtcDefinition): Promise<DtcDefinition> {
    const [result] = await db
      .insert(dtcDefinitions)
      .values({ ...def, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    if (!result) {
      throw new Error("Failed to create DTC definition");
    }
    return result;
  }
  async bulkInsertDtcDefinitions(defs: InsertDtcDefinition[]): Promise<number> {
    if (defs.length === 0) {
      return 0;
    }
    await db
      .insert(dtcDefinitions)
      .values(defs.map((def) => ({ ...def, createdAt: new Date(), updatedAt: new Date() })))
      .onConflictDoNothing();
    return defs.length;
  }

  async getActiveDtcs(
    equipmentId: string,
    orgId?: string
  ): Promise<(DtcFault & { definition?: DtcDefinition | undefined })[]> {
    const conditions = [eq(dtcFaults.equipmentId, equipmentId), eq(dtcFaults.active, true)];
    if (orgId) {
      conditions.push(eq(dtcFaults.orgId, orgId));
    }
    const faults = await db
      .select()
      .from(dtcFaults)
      .where(and(...conditions))
      .orderBy(sql`${dtcFaults.lastSeen} DESC`);
    return Promise.all(
      faults.map(async (fault) => {
        const definition = await this.getDtcDefinition(fault.spn, fault.fmi, "");
        return { ...fault, ...(definition !== undefined ? { definition } : {}) };
      })
    );
  }

  async getActiveDtcsBatch(
    equipmentIds: string[],
    orgId?: string
  ): Promise<(DtcFault & { definition?: DtcDefinition | undefined })[]> {
    if (equipmentIds.length === 0) {
      return [];
    }
    const conditions: SQL[] = [
      sql`${dtcFaults.equipmentId} IN (${sql.join(
        equipmentIds.map((id) => sql`${id}`),
        sql`, `
      )})`,
    ];
    conditions.push(eq(dtcFaults.active, true));
    if (orgId) {
      conditions.push(eq(dtcFaults.orgId, orgId));
    }
    const faults = await db
      .select()
      .from(dtcFaults)
      .where(and(...conditions))
      .orderBy(sql`${dtcFaults.lastSeen} DESC`);
    const defCache = new Map<string, DtcDefinition | undefined>();
    return Promise.all(
      faults.map(async (fault) => {
        const key = `${fault.spn}:${fault.fmi}`;
        if (!defCache.has(key)) {
          defCache.set(key, await this.getDtcDefinition(fault.spn, fault.fmi, ""));
        }
        return { ...fault, definition: defCache.get(key) };
      })
    );
  }
  async getDtcHistory(
    equipmentId: string,
    orgId?: string,
    filters?: {
      spn?: number | undefined;
      fmi?: number | undefined;
      severity?: number | undefined;
      from?: Date | undefined;
      to?: Date | undefined;
      limit?: number | undefined;
    }
  ): Promise<(DtcFault & { definition?: DtcDefinition | undefined })[]> {
    const conditions = [eq(dtcFaults.equipmentId, equipmentId)];
    if (orgId) {
      conditions.push(eq(dtcFaults.orgId, orgId));
    }
    if (filters?.spn !== undefined) {
      conditions.push(eq(dtcFaults.spn, filters.spn));
    }
    if (filters?.fmi !== undefined) {
      conditions.push(eq(dtcFaults.fmi, filters.fmi));
    }
    if (filters?.from) {
      conditions.push(gte(dtcFaults.lastSeen, filters.from));
    }
    if (filters?.to) {
      conditions.push(lte(dtcFaults.lastSeen, filters.to));
    }
    let query = db
      .select()
      .from(dtcFaults)
      .where(and(...conditions))
      .orderBy(sql`${dtcFaults.lastSeen} DESC`);
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    const faults = await query;
    let enriched = await Promise.all(
      faults.map(async (fault) => ({
        ...fault,
        definition: await this.getDtcDefinition(fault.spn, fault.fmi, ""),
      }))
    );
    if (filters?.severity !== undefined) {
      enriched = enriched.filter((f) => f.definition?.severity === filters.severity);
    }
    return enriched;
  }

  async upsertDtcFault(fault: InsertDtcFault): Promise<DtcFault> {
    const [e] = await db
      .select()
      .from(dtcFaults)
      .where(
        and(
          eq(dtcFaults.deviceId, fault.deviceId),
          eq(dtcFaults.spn, fault.spn),
          eq(dtcFaults.fmi, fault.fmi)
        )
      )
      .orderBy(sql`${dtcFaults.lastSeen} DESC`)
      .limit(1);
    if (e) {
      const [result] = await db
        .update(dtcFaults)
        .set({ active: fault.active, lastSeen: new Date(), oc: fault.oc, lamp: fault.lamp })
        .where(eq(dtcFaults.id, e.id))
        .returning();
      if (!result) {throw new Error("Failed to update DTC fault");}
      return result;
    }
    const [result] = await db
      .insert(dtcFaults)
      .values({ ...fault, firstSeen: new Date(), lastSeen: new Date() })
      .returning();
    if (!result) {throw new Error("Failed to insert DTC fault");}
    return result;
  }
  async clearDtcFault(
    equipmentId: string,
    spn: number,
    fmi: number,
    orgId?: string
  ): Promise<void> {
    const conditions = [
      eq(dtcFaults.equipmentId, equipmentId),
      eq(dtcFaults.spn, spn),
      eq(dtcFaults.fmi, fmi),
    ];
    if (orgId) {
      conditions.push(eq(dtcFaults.orgId, orgId));
    }
    await db
      .update(dtcFaults)
      .set({ active: false, lastSeen: new Date() })
      .where(and(...conditions));
  }
  async clearAllDtcFaults(equipmentId: string, orgId?: string): Promise<number> {
    const conditions = [eq(dtcFaults.equipmentId, equipmentId), eq(dtcFaults.active, true)];
    if (orgId) {
      conditions.push(eq(dtcFaults.orgId, orgId));
    }
    const result = await db
      .update(dtcFaults)
      .set({ active: false, lastSeen: new Date() })
      .where(and(...conditions))
      .returning();
    return result.length;
  }
  async clearInactiveDtcs(
    deviceId: string,
    activeSPNs: Array<{ spn: number; fmi: number }>
  ): Promise<number> {
    if (activeSPNs.length === 0) {
      const result = await db
        .update(dtcFaults)
        .set({ active: false, lastSeen: new Date() })
        .where(and(eq(dtcFaults.deviceId, deviceId), eq(dtcFaults.active, true)))
        .returning();
      return result.length;
    }
    const currentActive = await db
      .select()
      .from(dtcFaults)
      .where(and(eq(dtcFaults.deviceId, deviceId), eq(dtcFaults.active, true)));
    const toDeactivate = currentActive.filter(
      (fault) => !activeSPNs.some((active) => active.spn === fault.spn && active.fmi === fault.fmi)
    );
    if (toDeactivate.length === 0) {
      return 0;
    }
    const deactivated = await Promise.all(
      toDeactivate.map((fault) =>
        db
          .update(dtcFaults)
          .set({ active: false, lastSeen: new Date() })
          .where(eq(dtcFaults.id, fault.id))
          .returning()
      )
    );
    return deactivated.length;
  }
}
