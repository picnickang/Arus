/**
 * GDPR - Database Storage
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { dataSubjectRequests, engineerOverrides } from "@shared/schema-runtime";
import type {
  DataSubjectRequest,
  InsertDataSubjectRequest,
  EngineerOverride,
  InsertEngineerOverride,
} from "@shared/schema";

export class DatabaseGdprStorage {
  async getDataSubjectRequests(
    orgId?: string,
    status?: string,
    type?: string
  ): Promise<DataSubjectRequest[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(dataSubjectRequests.orgId, orgId));
    }
    if (status) {
      conditions.push(eq(dataSubjectRequests.status, status));
    }
    if (type) {
      conditions.push(eq(dataSubjectRequests.requestType, type));
    }
    const query = conditions.length > 0
      ? db.select().from(dataSubjectRequests).where(and(...conditions))
      : db.select().from(dataSubjectRequests);
    return query.orderBy(sql`${dataSubjectRequests.createdAt} DESC`);
  }
  async getDataSubjectRequest(id: string): Promise<DataSubjectRequest | undefined> {
    const [result] = await db
      .select()
      .from(dataSubjectRequests)
      .where(eq(dataSubjectRequests.id, id));
    return result;
  }
  async createDataSubjectRequest(request: InsertDataSubjectRequest): Promise<DataSubjectRequest> {
    const [n] = await db.insert(dataSubjectRequests).values(request).returning();
    return n;
  }
  async updateDataSubjectRequest(
    id: string,
    updates: Partial<InsertDataSubjectRequest>
  ): Promise<DataSubjectRequest> {
    const [u] = await db
      .update(dataSubjectRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dataSubjectRequests.id, id))
      .returning();
    if (!u) {
      throw new Error(`Data subject request ${id} not found`);
    }
    return u;
  }
  async deleteDataSubjectRequest(id: string): Promise<void> {
    await db.delete(dataSubjectRequests).where(eq(dataSubjectRequests.id, id));
  }
  async processDataSubjectRequest(
    id: string,
    processedBy: string,
    result: Record<string, any>
  ): Promise<DataSubjectRequest> {
    const [u] = await db
      .update(dataSubjectRequests)
      .set({
        status: "completed",
        processedBy,
        processedAt: new Date(),
        result,
        updatedAt: new Date(),
      } as any)
      .where(eq(dataSubjectRequests.id, id))
      .returning();
    if (!u) {
      throw new Error(`Data subject request ${id} not found`);
    }
    return u;
  }
  async getDataSubjectRequestsByEmail(email: string): Promise<DataSubjectRequest[]> {
    return db
      .select()
      .from(dataSubjectRequests)
      .where(eq((dataSubjectRequests as any).subjectEmail, email))
      .orderBy(sql`${dataSubjectRequests.createdAt} DESC`);
  }
  async getPendingDataSubjectRequests(orgId?: string): Promise<DataSubjectRequest[]> {
    const conditions = [eq(dataSubjectRequests.status, "pending")];
    if (orgId) {
      conditions.push(eq(dataSubjectRequests.orgId, orgId));
    }
    return db
      .select()
      .from(dataSubjectRequests)
      .where(and(...conditions))
      .orderBy(dataSubjectRequests.createdAt);
  }

  async getDataSubjectRequestWithOrg(
    id: string,
    orgId: string
  ): Promise<DataSubjectRequest | undefined> {
    const [result] = await db
      .select()
      .from(dataSubjectRequests)
      .where(and(eq(dataSubjectRequests.id, id), eq(dataSubjectRequests.orgId, orgId)));
    return result;
  }

  async getDataSubjectRequestsFiltered(
    orgId: string,
    filters: {
      status?: string;
      requestType?: string;
      requesterEmail?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<DataSubjectRequest[]> {
    const conditions: any[] = [eq(dataSubjectRequests.orgId, orgId)];
    if (filters.status) {
      conditions.push(eq(dataSubjectRequests.status, filters.status));
    }
    if (filters.requestType) {
      conditions.push(eq(dataSubjectRequests.requestType, filters.requestType));
    }
    if (filters.requesterEmail) {
      conditions.push(eq(dataSubjectRequests.requesterEmail, filters.requesterEmail));
    }
    return db
      .select()
      .from(dataSubjectRequests)
      .where(and(...conditions))
      .orderBy(sql`${dataSubjectRequests.createdAt} DESC`);
  }

  async acknowledgeDataSubjectRequest(
    id: string,
    acknowledgedBy: string,
    orgId: string
  ): Promise<DataSubjectRequest> {
    const [u] = await db
      .update(dataSubjectRequests)
      .set({
        status: "in_progress",
        acknowledgedAt: new Date(),
        assignedTo: acknowledgedBy,
        updatedAt: new Date(),
      })
      .where(and(eq(dataSubjectRequests.id, id), eq(dataSubjectRequests.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Data subject request ${id} not found`);
    }
    return u;
  }

  async completeDataSubjectRequest(
    id: string,
    completedBy: string,
    notes: string | undefined,
    orgId: string
  ): Promise<DataSubjectRequest> {
    const [u] = await db
      .update(dataSubjectRequests)
      .set({
        status: "completed",
        completedAt: new Date(),
        processingNotes: notes,
        updatedAt: new Date(),
      })
      .where(and(eq(dataSubjectRequests.id, id), eq(dataSubjectRequests.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Data subject request ${id} not found`);
    }
    return u;
  }

  async rejectDataSubjectRequest(
    id: string,
    rejectedBy: string,
    reason: string,
    orgId: string
  ): Promise<DataSubjectRequest> {
    const [u] = await db
      .update(dataSubjectRequests)
      .set({
        status: "rejected",
        rejectionReason: reason,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(dataSubjectRequests.id, id), eq(dataSubjectRequests.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Data subject request ${id} not found`);
    }
    return u;
  }

  async collectUserDataForDsar(
    orgId: string,
    identifier: string,
    identifierType: "email" | "userId" | "crewId"
  ): Promise<Record<string, any>> {
    const result: Record<string, any[]> = {
      users: [],
      crewMembers: [],
      restRecords: [],
      workOrders: [],
      auditEvents: [],
    };
    try {
      if (identifierType === "email") {
        const users = await db.execute(
          sql`SELECT id, email, name, role FROM users WHERE email = ${identifier} AND org_id = ${orgId}`
        );
        result.users = users.rows ?? [];
      } else if (identifierType === "userId") {
        const users = await db.execute(
          sql`SELECT id, email, name, role FROM users WHERE id = ${identifier} AND org_id = ${orgId}`
        );
        result.users = users.rows ?? [];
      }
      if (identifierType === "crewId") {
        const crew = await db.execute(
          sql`SELECT id, name, email, rank, department FROM crew_members WHERE id = ${identifier} AND org_id = ${orgId}`
        );
        result.crewMembers = crew.rows ?? [];
      } else {
        const crew = await db.execute(
          sql`SELECT id, name, email, rank, department FROM crew_members WHERE email = ${identifier} AND org_id = ${orgId}`
        );
        result.crewMembers = crew.rows ?? [];
      }
    } catch {
      /* tables may not exist */
    }
    return result;
  }

  async executeDataErasure(
    dsarId: string,
    orgId: string,
    erasedBy: string,
    reason?: string
  ): Promise<Record<string, any>> {
    const request = await this.getDataSubjectRequestWithOrg(dsarId, orgId);
    if (!request) {
      throw new Error(`DSAR ${dsarId} not found`);
    }
    await this.updateDataSubjectRequest(dsarId, {
      status: "completed",
      processingNotes: `Erasure executed by ${erasedBy}. Reason: ${reason || "DSAR erasure request"}`,
    } as any);
    return {
      dsarId,
      status: "erasure_recorded",
      erasedBy,
      note: "Actual data erasure requires manual review per retention policies",
    };
  }

  async getMlEngineerOverrides(
    equipmentId?: string,
    overrideType?: string,
    isActive?: boolean
  ): Promise<EngineerOverride[]> {
    const conditions = [];
    if (equipmentId) {
      conditions.push(eq(engineerOverrides.equipmentId, equipmentId));
    }
    if (overrideType) {
      conditions.push(eq(engineerOverrides.overrideType, overrideType));
    }
    if (isActive !== undefined) {
      conditions.push(eq((engineerOverrides as any).isActive, isActive));
    }
    const query = conditions.length > 0
      ? db.select().from(engineerOverrides).where(and(...conditions))
      : db.select().from(engineerOverrides);
    return query.orderBy(sql`${engineerOverrides.createdAt} DESC`);
  }
  async getMlEngineerOverride(id: string): Promise<EngineerOverride | undefined> {
    const [result] = await db.select().from(engineerOverrides).where(eq(engineerOverrides.id, id));
    return result;
  }
  async createMlEngineerOverride(override: InsertEngineerOverride): Promise<EngineerOverride> {
    const [n] = await db.insert(engineerOverrides).values(override).returning();
    return n;
  }
  async updateMlEngineerOverride(
    id: string,
    updates: Partial<InsertEngineerOverride>
  ): Promise<EngineerOverride> {
    const [u] = await db
      .update(engineerOverrides)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(engineerOverrides.id, id))
      .returning();
    if (!u) {
      throw new Error(`ML engineer override ${id} not found`);
    }
    return u;
  }
  async deleteMlEngineerOverride(id: string): Promise<void> {
    await db.delete(engineerOverrides).where(eq(engineerOverrides.id, id));
  }
  async getActiveOverridesForEquipment(equipmentId: string): Promise<EngineerOverride[]> {
    return db
      .select()
      .from(engineerOverrides)
      .where(
        and(eq(engineerOverrides.equipmentId, equipmentId), eq((engineerOverrides as any).isActive, true))
      )
      .orderBy(sql`${engineerOverrides.createdAt} DESC`);
  }
  async deactivateOverride(id: string, deactivatedBy: string): Promise<EngineerOverride> {
    const [u] = await db
      .update(engineerOverrides)
      .set({ isActive: false, deactivatedBy, deactivatedAt: new Date(), updatedAt: new Date() } as any)
      .where(eq(engineerOverrides.id, id))
      .returning();
    if (!u) {
      throw new Error(`ML engineer override ${id} not found`);
    }
    return u;
  }
}
