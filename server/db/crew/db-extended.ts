/**
 * Crew - Database Storage Extended (Assignments, Certifications, Leave)
 */

import { randomUUID } from "node:crypto";
import { eq, and, lte, gte, or, sql, inArray } from "drizzle-orm";
import { db } from "../../db-config";
import { crew, crewAssignment as crewAssignmentTable, crewCertification as crewCertificationTable, crewLeave as crewLeaveTable, type Crew, type CrewAssignment, type InsertCrewAssignment, type CrewCertification, type InsertCrewCertification, type CrewLeave, type InsertCrewLeave } from "@shared/schema-runtime";
import type { CrewAssignmentFilters } from "./types.js";

export class DbCrewExtended {
  private validateOrgId(orgId: string | undefined, method: string): void { if (!orgId) { throw new Error(`[${method}] orgId is required`); } }

  async getCrewAssignments(orgId?: string, filters?: CrewAssignmentFilters): Promise<CrewAssignment[]> {
    const conditions: any[] = [];
    if (orgId) {conditions.push(eq(crewAssignmentTable.orgId, orgId));}
    if (filters?.crewId) {conditions.push(eq(crewAssignmentTable.crewId, filters.crewId));}
    if (filters?.vesselId) {conditions.push(eq(crewAssignmentTable.vesselId, filters.vesselId));}
    if (conditions.length > 0) {return db.select().from(crewAssignmentTable).where(and(...conditions)).orderBy(sql`${crewAssignmentTable.start} DESC`);}
    return db.select().from(crewAssignmentTable).orderBy(sql`${crewAssignmentTable.start} DESC`);
  }
  async getCrewAssignment(id: string, orgId?: string): Promise<CrewAssignment | undefined> { const conditions = orgId ? and(eq(crewAssignmentTable.id, id), eq(crewAssignmentTable.orgId, orgId)) : eq(crewAssignmentTable.id, id); const [result] = await db.select().from(crewAssignmentTable).where(conditions); return result; }
  async createCrewAssignment(assignment: InsertCrewAssignment): Promise<CrewAssignment> { const [n] = await db.insert(crewAssignmentTable).values({ id: randomUUID(), ...assignment, createdAt: new Date(), updatedAt: new Date() }).returning(); return n; }
  async updateCrewAssignment(id: string, updates: Partial<InsertCrewAssignment>, orgId?: string): Promise<CrewAssignment> { this.validateOrgId(orgId, "updateCrewAssignment"); const conditions = orgId ? and(eq(crewAssignmentTable.id, id), eq(crewAssignmentTable.orgId, orgId)) : eq(crewAssignmentTable.id, id); const [updated] = await db.update(crewAssignmentTable).set({ ...updates, updatedAt: new Date() }).where(conditions).returning(); if (!updated) {throw new Error(`Crew assignment ${id} not found`);} return updated; }
  async deleteCrewAssignment(id: string, orgId?: string): Promise<void> { this.validateOrgId(orgId, "deleteCrewAssignment"); const conditions = orgId ? and(eq(crewAssignmentTable.id, id), eq(crewAssignmentTable.orgId, orgId)) : eq(crewAssignmentTable.id, id); await db.delete(crewAssignmentTable).where(conditions); }

  async createBulkCrewAssignments(assignments: InsertCrewAssignment[]): Promise<CrewAssignment[]> {
    if (assignments.length === 0) {return [];}
    return db.insert(crewAssignmentTable).values(assignments.map(a => ({ id: randomUUID(), ...a, createdAt: new Date(), updatedAt: new Date() }))).returning();
  }

  async getCrewAssignmentsByDateRange(from: Date, to: Date, orgId?: string): Promise<CrewAssignment[]> {
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    const conditions: any[] = [gte(crewAssignmentTable.date, fromStr), lte(crewAssignmentTable.date, toStr)];
    if (orgId) { conditions.push(eq(crewAssignmentTable.orgId, orgId)); }
    return db.select().from(crewAssignmentTable).where(and(...conditions)).orderBy(crewAssignmentTable.date);
  }

  async deleteCrewAssignmentsByRunId(orgId: string, runId: string): Promise<number> {
    this.validateOrgId(orgId, "deleteCrewAssignmentsByRunId");
    const result = await db.execute(sql`
      DELETE FROM crew_assignment 
      WHERE org_id = ${orgId} 
        AND generated_by_run_id = ${runId} 
        AND status = 'draft'
      RETURNING id
    `);
    return result.rowCount ?? 0;
  }

  async getCrewCertifications(crewId?: string, orgId?: string): Promise<CrewCertification[]> { const conditions: any[] = []; if (orgId) {conditions.push(eq(crewCertificationTable.orgId, orgId));} if (crewId) {conditions.push(eq(crewCertificationTable.crewId, crewId));} if (conditions.length > 0) {return db.select().from(crewCertificationTable).where(and(...conditions));} return db.select().from(crewCertificationTable); }
  async createCrewCertification(cert: InsertCrewCertification): Promise<CrewCertification> { const [n] = await db.insert(crewCertificationTable).values({ id: randomUUID(), ...cert, createdAt: new Date(), updatedAt: new Date() }).returning(); return n; }
  async updateCrewCertification(id: string, updates: Partial<InsertCrewCertification>, orgId?: string): Promise<CrewCertification> { this.validateOrgId(orgId, "updateCrewCertification"); const conditions = orgId ? and(eq(crewCertificationTable.id, id), eq(crewCertificationTable.orgId, orgId)) : eq(crewCertificationTable.id, id); const [updated] = await db.update(crewCertificationTable).set({ ...updates, updatedAt: new Date() }).where(conditions).returning(); if (!updated) {throw new Error(`Crew certification ${id} not found`);} return updated; }
  async deleteCrewCertification(id: string, orgId?: string): Promise<void> { this.validateOrgId(orgId, "deleteCrewCertification"); const conditions = orgId ? and(eq(crewCertificationTable.id, id), eq(crewCertificationTable.orgId, orgId)) : eq(crewCertificationTable.id, id); await db.delete(crewCertificationTable).where(conditions); }
  async getExpiringCertifications(days: number = 90, orgId?: string): Promise<CrewCertification[]> { const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + days); const conditions: any[] = [lte(crewCertificationTable.expiryDate, futureDate)]; if (orgId) {conditions.push(eq(crewCertificationTable.orgId, orgId));} return db.select().from(crewCertificationTable).where(and(...conditions)).orderBy(crewCertificationTable.expiryDate); }

  async getCrewLeave(crewId?: string, orgId?: string): Promise<CrewLeave[]> { const conditions: any[] = []; if (orgId) {conditions.push(eq(crewLeaveTable.orgId, orgId));} if (crewId) {conditions.push(eq(crewLeaveTable.crewId, crewId));} if (conditions.length > 0) {return db.select().from(crewLeaveTable).where(and(...conditions)).orderBy(sql`${crewLeaveTable.start} DESC`);} return db.select().from(crewLeaveTable).orderBy(sql`${crewLeaveTable.start} DESC`); }
  async createCrewLeave(leave: InsertCrewLeave): Promise<CrewLeave> { const [n] = await db.insert(crewLeaveTable).values({ id: randomUUID(), ...leave, status: leave.status || "pending", createdAt: new Date(), updatedAt: new Date() }).returning(); return n; }
  async updateCrewLeave(id: string, updates: Partial<InsertCrewLeave>, orgId?: string): Promise<CrewLeave> { this.validateOrgId(orgId, "updateCrewLeave"); const conditions = orgId ? and(eq(crewLeaveTable.id, id), eq(crewLeaveTable.orgId, orgId)) : eq(crewLeaveTable.id, id); const [updated] = await db.update(crewLeaveTable).set({ ...updates, updatedAt: new Date() }).where(conditions).returning(); if (!updated) {throw new Error(`Crew leave ${id} not found`);} return updated; }
  async deleteCrewLeave(id: string, orgId?: string): Promise<void> { this.validateOrgId(orgId, "deleteCrewLeave"); const conditions = orgId ? and(eq(crewLeaveTable.id, id), eq(crewLeaveTable.orgId, orgId)) : eq(crewLeaveTable.id, id); await db.delete(crewLeaveTable).where(conditions); }

  async getActiveCrewOnVessel(vesselId: string, date: Date, orgId: string): Promise<Crew[]> {
    this.validateOrgId(orgId, "getActiveCrewOnVessel");
    const assignments = await db.select().from(crewAssignmentTable).where(and(eq(crewAssignmentTable.vesselId, vesselId), eq(crewAssignmentTable.orgId, orgId), lte(crewAssignmentTable.startDate, date), or(gte(crewAssignmentTable.endDate, date), sql`${crewAssignmentTable.endDate} IS NULL`)));
    if (assignments.length === 0) {return [];}
    const crewIds = assignments.map((a) => a.crewId);
    return db.select().from(crew).where(inArray(crew.id, crewIds));
  }
}
