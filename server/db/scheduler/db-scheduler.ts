/**
 * Scheduler - Database Storage
 */

import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { recordAndPublish } from "../../sync-events";
import { schedulerRuns, drydockWindow, scheduleAssignments, scheduleUnfilled, type SchedulerRun, type InsertSchedulerRun, type DrydockWindow, type InsertDrydockWindow } from "@shared/schema-runtime";

export class DatabaseSchedulerStorage {
  async getSchedulerRuns(orgId?: string, status?: string, limit?: number): Promise<SchedulerRun[]> { 
    const conditions = []; 
    if (orgId) {conditions.push(eq(schedulerRuns.orgId, orgId));} 
    if (status) {conditions.push(eq(schedulerRuns.status, status));} 
    let query = db.select().from(schedulerRuns); 
    if (conditions.length > 0) {query = query.where(and(...conditions));} 
    query = query.orderBy(sql`${schedulerRuns.createdAt} DESC`); 
    if (limit) {query = query.limit(limit);} 
    return query; 
  }

  async getSchedulerRun(id: string): Promise<SchedulerRun | undefined> { 
    const [result] = await db.select().from(schedulerRuns).where(eq(schedulerRuns.id, id)); 
    return result; 
  }

  async createSchedulerRun(run: InsertSchedulerRun): Promise<SchedulerRun> { 
    const [n] = await db.insert(schedulerRuns).values(run).returning(); 
    return n; 
  }

  async updateSchedulerRun(id: string, updates: Partial<InsertSchedulerRun>): Promise<SchedulerRun> { 
    const [u] = await recordAndPublish(db.update(schedulerRuns).set({ ...updates, updatedAt: new Date() }).where(eq(schedulerRuns.id, id)).returning(), "scheduler_run", "update"); 
    if (!u) {throw new Error(`Scheduler run ${id} not found`);} 
    return u; 
  }

  async getLatestSchedulerRun(orgId: string): Promise<SchedulerRun | undefined> { 
    const [result] = await db.select().from(schedulerRuns).where(eq(schedulerRuns.orgId, orgId)).orderBy(sql`${schedulerRuns.createdAt} DESC`).limit(1); 
    return result; 
  }

  async completeSchedulerRun(id: string, result: Record<string, any>): Promise<SchedulerRun> { 
    const [u] = await db.update(schedulerRuns).set({ status: 'completed', completedAt: new Date(), result, updatedAt: new Date() }).where(eq(schedulerRuns.id, id)).returning(); 
    if (!u) {throw new Error(`Scheduler run ${id} not found`);} 
    return u; 
  }

  async failSchedulerRun(id: string, error: string): Promise<SchedulerRun> { 
    const [u] = await db.update(schedulerRuns).set({ status: 'failed', error, completedAt: new Date(), updatedAt: new Date() }).where(eq(schedulerRuns.id, id)).returning(); 
    if (!u) {throw new Error(`Scheduler run ${id} not found`);} 
    return u; 
  }

  async getScheduleAssignmentsByRun(runId: string): Promise<any[]> {
    console.warn(`[DatabaseSchedulerStorage] getScheduleAssignmentsByRun not yet implemented for runId=${runId}`);
    return [];
  }

  async deleteSchedulerRuns(orgId: string): Promise<void> {
    await db.delete(schedulerRuns).where(eq(schedulerRuns.orgId, orgId));
  }

  async deleteScheduleAssignmentsByOrg(orgId: string): Promise<void> {
    // Get all run IDs for this org first, then delete assignments
    const runs = await this.getSchedulerRuns(orgId);
    for (const run of runs) {
      await db.delete(scheduleAssignments).where(eq(scheduleAssignments.runId, run.id));
    }
  }

  async deleteScheduleUnfilledByOrg(orgId: string): Promise<void> {
    // scheduleUnfilled doesn't have org_id column, delete by run_id
    const runs = await this.getSchedulerRuns(orgId);
    for (const run of runs) {
      await db.delete(scheduleUnfilled).where(eq(scheduleUnfilled.runId, run.id));
    }
  }

  async getDrydockWindows(vesselId?: string, status?: string): Promise<DrydockWindow[]> { 
    const conditions = []; 
    if (vesselId) {conditions.push(eq(drydockWindow.vesselId, vesselId));} 
    if (status) {conditions.push(eq(drydockWindow.status, status));} 
    let query = db.select().from(drydockWindow); 
    if (conditions.length > 0) {query = query.where(and(...conditions));} 
    return query.orderBy(drydockWindow.startDate); 
  }

  async getDrydockWindowById(id: string): Promise<DrydockWindow | undefined> { 
    const [result] = await db.select().from(drydockWindow).where(eq(drydockWindow.id, id)); 
    return result; 
  }

  async createDrydockWindow(window: InsertDrydockWindow): Promise<DrydockWindow> { 
    const [n] = await db.insert(drydockWindow).values(window).returning(); 
    return n; 
  }

  async updateDrydockWindow(id: string, updates: Partial<InsertDrydockWindow>): Promise<DrydockWindow> { 
    const [u] = await db.update(drydockWindow).set({ ...updates, updatedAt: new Date() }).where(eq(drydockWindow.id, id)).returning(); 
    if (!u) {throw new Error(`Drydock window ${id} not found`);} 
    return u; 
  }

  async deleteDrydockWindow(id: string): Promise<void> { 
    await db.delete(drydockWindow).where(eq(drydockWindow.id, id)); 
  }

  async getUpcomingDrydockWindows(vesselId?: string, days: number = 90): Promise<DrydockWindow[]> { 
    const now = new Date(); 
    const cutoff = new Date(); 
    cutoff.setDate(cutoff.getDate() + days); 
    const conditions = [gte(drydockWindow.startDate, now), lte(drydockWindow.startDate, cutoff)]; 
    if (vesselId) {conditions.push(eq(drydockWindow.vesselId, vesselId));} 
    return db.select().from(drydockWindow).where(and(...conditions)).orderBy(drydockWindow.startDate); 
  }

  async getActiveDrydockWindow(vesselId: string): Promise<DrydockWindow | undefined> { 
    const now = new Date(); 
    const [result] = await db.select().from(drydockWindow).where(and(eq(drydockWindow.vesselId, vesselId), lte(drydockWindow.startDate, now), gte(drydockWindow.endDate, now))).limit(1); 
    return result; 
  }
}
