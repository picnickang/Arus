/**
 * Crew - Database Storage Members
 */

import { randomUUID } from "node:crypto";
import { eq, and, type SQL } from "drizzle-orm";
import { db } from "../../db-config";
import { crew, shiftTemplate, crewSkill } from "@shared/schema-runtime";
import type {
  Crew,
  InsertCrew,
  ShiftTemplate,
  InsertShiftTemplate,
  CrewSkill,
} from "@shared/schema";
import type { CrewFilters } from "./types.js";

export class DbCrewMembers {
  private validateOrgId(orgId: string | undefined, method: string): void {
    if (!orgId) {
      throw new Error(`[${method}] orgId is required`);
    }
  }

  async getCrewMembers(orgId?: string, filters?: CrewFilters): Promise<Crew[]> {
    const conditions: SQL[] = [];
    if (orgId) {
      conditions.push(eq(crew.orgId, orgId));
    }
    if (filters?.vesselId) {
      conditions.push(eq(crew.vesselId, filters.vesselId));
    }
    if (filters?.rank) {
      conditions.push(eq(crew.rank, filters.rank));
    }
    // NOTE: CrewFilters.status is ignored — crew table has no `status` column
    // (use `active` / `onDuty` / `terminationType` instead). Kept here for callsite compat.
    if (conditions.length > 0) {
      return db
        .select()
        .from(crew)
        .where(and(...conditions))
        .orderBy(crew.name);
    }
    return db.select().from(crew).orderBy(crew.name);
  }

  async getCrewMember(id: string, orgId?: string): Promise<Crew | undefined> {
    const conditions = orgId ? and(eq(crew.id, id), eq(crew.orgId, orgId)) : eq(crew.id, id);
    const [result] = await db.select().from(crew).where(conditions);
    return result;
  }
  async createCrewMember(crewData: InsertCrew): Promise<Crew> {
    const [newCrew] = await db
      .insert(crew)
      .values({
        id: randomUUID(),
        ...crewData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    if (!newCrew) throw new Error("Failed to create crew member");
    return newCrew;
  }
  async updateCrewMember(id: string, updates: Partial<InsertCrew>, orgId?: string): Promise<Crew> {
    this.validateOrgId(orgId, "updateCrewMember");
    const conditions = orgId ? and(eq(crew.id, id), eq(crew.orgId, orgId)) : eq(crew.id, id);
    const [updated] = await db
      .update(crew)
      .set({ ...updates, updatedAt: new Date() })
      .where(conditions)
      .returning();
    if (!updated) {
      throw new Error(`Crew member ${id} not found`);
    }
    return updated;
  }
  async deleteCrewMember(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deleteCrewMember");
    const conditions = orgId ? and(eq(crew.id, id), eq(crew.orgId, orgId)) : eq(crew.id, id);
    await db.delete(crew).where(conditions);
  }
  async getCrew(orgId?: string, vesselId?: string): Promise<Crew[]> {
    return this.getCrewMembers(orgId, vesselId ? { vesselId } : undefined);
  }
  async createCrew(crewData: InsertCrew): Promise<Crew> {
    return this.createCrewMember(crewData);
  }
  async updateCrew(id: string, updates: Partial<InsertCrew>, orgId?: string): Promise<Crew> {
    return this.updateCrewMember(id, updates, orgId);
  }

  async getShiftTemplates(vesselId?: string): Promise<ShiftTemplate[]> {
    if (vesselId) {
      return db.select().from(shiftTemplate).where(eq(shiftTemplate.vesselId, vesselId));
    }
    return db.select().from(shiftTemplate);
  }
  async createShiftTemplate(data: InsertShiftTemplate): Promise<ShiftTemplate> {
    const [result] = await db
      .insert(shiftTemplate)
      .values({ id: randomUUID(), ...data, createdAt: new Date() })
      .returning();
    if (!result) throw new Error("Failed to create shift template");
    return result;
  }
  async updateShiftTemplate(
    id: string,
    updates: Partial<InsertShiftTemplate>,
    orgId?: string
  ): Promise<ShiftTemplate> {
    this.validateOrgId(orgId, "updateShiftTemplate");
    const conditions = orgId
      ? and(eq(shiftTemplate.id, id), eq(shiftTemplate.orgId, orgId))
      : eq(shiftTemplate.id, id);
    const [updated] = await db.update(shiftTemplate).set(updates).where(conditions).returning();
    if (!updated) {
      throw new Error(`Shift template ${id} not found`);
    }
    return updated;
  }
  async deleteShiftTemplate(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deleteShiftTemplate");
    const conditions = orgId
      ? and(eq(shiftTemplate.id, id), eq(shiftTemplate.orgId, orgId))
      : eq(shiftTemplate.id, id);
    await db.delete(shiftTemplate).where(conditions);
  }

  async getCrewSkills(crewId: string): Promise<CrewSkill[]> {
    return db.select().from(crewSkill).where(eq(crewSkill.crewId, crewId));
  }
}
