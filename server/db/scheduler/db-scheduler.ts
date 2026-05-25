/**
 * Scheduler - Database Storage
 */

import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { recordAndPublish } from "../../sync-events";
import {
  schedulerRuns,
  drydockWindow,
  scheduleAssignments,
  scheduleUnfilled,
} from "@shared/schema-runtime";
import type {
  SchedulerRun,
  InsertSchedulerRun,
  DrydockWindow,
  InsertDrydockWindow,
} from "@shared/schema";
import { schedulingSettings, type SelectSchedulingSettings } from "@shared/schema";

export class DatabaseSchedulerStorage {
  async getSchedulerRuns(orgId?: string, status?: string, limit?: number): Promise<SchedulerRun[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(schedulerRuns.orgId, orgId));
    }
    if (status) {
      conditions.push(eq(schedulerRuns.status, status));
    }
    const base = db.select().from(schedulerRuns);
    const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;
    const ordered = filtered.orderBy(sql`${schedulerRuns.createdAt} DESC`);
    return limit ? ordered.limit(limit) : ordered;
  }

  async getSchedulerRun(id: string): Promise<SchedulerRun | undefined> {
    const [result] = await db.select().from(schedulerRuns).where(eq(schedulerRuns.id, id));
    return result;
  }

  async createSchedulerRun(run: InsertSchedulerRun): Promise<SchedulerRun> {
    const [n] = await db.insert(schedulerRuns).values(run).returning();
    if (!n) throw new Error("Failed to create scheduler run");
    return n;
  }

  async updateSchedulerRun(
    id: string,
    updates: Partial<InsertSchedulerRun>
  ): Promise<SchedulerRun> {
    const [u] = await db
      .update(schedulerRuns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schedulerRuns.id, id))
      .returning();
    if (!u) {
      throw new Error(`Scheduler run ${id} not found`);
    }
    await recordAndPublish(
      "scheduler_run" as Parameters<typeof recordAndPublish>[0],
      id,
      "update",
      u
    );
    return u;
  }

  async getLatestSchedulerRun(orgId: string): Promise<SchedulerRun | undefined> {
    const [result] = await db
      .select()
      .from(schedulerRuns)
      .where(eq(schedulerRuns.orgId, orgId))
      .orderBy(sql`${schedulerRuns.createdAt} DESC`)
      .limit(1);
    return result;
  }

  async completeSchedulerRun(id: string, result: Record<string, unknown>): Promise<SchedulerRun> {
    const [u] = await db
      .update(schedulerRuns)
      .set({ status: "completed", finishedAt: new Date(), stats: result, updatedAt: new Date() } as never)
      .where(eq(schedulerRuns.id, id))
      .returning();
    if (!u) {
      throw new Error(`Scheduler run ${id} not found`);
    }
    return u;
  }

  async failSchedulerRun(id: string, error: string): Promise<SchedulerRun> {
    const [u] = await db
      .update(schedulerRuns)
      .set({ status: "failed", errorMessage: error, finishedAt: new Date(), updatedAt: new Date() } as never)
      .where(eq(schedulerRuns.id, id))
      .returning();
    if (!u) {
      throw new Error(`Scheduler run ${id} not found`);
    }
    return u;
  }

  async getScheduleAssignmentsByRun(runId: string) {
    return db
      .select()
      .from(scheduleAssignments)
      .where(eq(scheduleAssignments.runId, runId))
      .orderBy(scheduleAssignments.start);
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
    if (vesselId) {
      conditions.push(eq(drydockWindow.vesselId, vesselId));
    }
    if (status) {
      conditions.push(eq(drydockWindow.status, status));
    }
    const base = db.select().from(drydockWindow);
    const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;
    return filtered.orderBy(drydockWindow.start);
  }

  async getDrydockWindowById(id: string): Promise<DrydockWindow | undefined> {
    const [result] = await db.select().from(drydockWindow).where(eq(drydockWindow.id, id));
    return result;
  }

  async createDrydockWindow(window: InsertDrydockWindow): Promise<DrydockWindow> {
    const [n] = await db.insert(drydockWindow).values(window).returning();
    if (!n) {
      throw new Error("Failed to create drydock window");
    }
    return n;
  }

  async updateDrydockWindow(
    id: string,
    updates: Partial<InsertDrydockWindow>
  ): Promise<DrydockWindow> {
    const [u] = await db
      .update(drydockWindow)
      .set({ ...updates })
      .where(eq(drydockWindow.id, id))
      .returning();
    if (!u) {
      throw new Error(`Drydock window ${id} not found`);
    }
    return u;
  }

  async deleteDrydockWindow(id: string): Promise<void> {
    await db.delete(drydockWindow).where(eq(drydockWindow.id, id));
  }

  async getUpcomingDrydockWindows(vesselId?: string, days: number = 90): Promise<DrydockWindow[]> {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const conditions = [gte(drydockWindow.start, now), lte(drydockWindow.start, cutoff)];
    if (vesselId) {
      conditions.push(eq(drydockWindow.vesselId, vesselId));
    }
    return db
      .select()
      .from(drydockWindow)
      .where(and(...conditions))
      .orderBy(drydockWindow.start);
  }

  async getActiveDrydockWindow(vesselId: string): Promise<DrydockWindow | undefined> {
    const now = new Date();
    const [result] = await db
      .select()
      .from(drydockWindow)
      .where(
        and(
          eq(drydockWindow.vesselId, vesselId),
          lte(drydockWindow.start, now),
          gte(drydockWindow.end, now)
        )
      )
      .limit(1);
    return result;
  }

  async markSchedulerRunHorGenerated(runId: string): Promise<SchedulerRun> {
    const [u] = await db
      .update(schedulerRuns)
      .set({ horGenerated: true, horGeneratedAt: new Date(), updatedAt: new Date() })
      .where(eq(schedulerRuns.id, runId))
      .returning();
    if (!u) {
      throw new Error(`Scheduler run ${runId} not found`);
    }
    return u;
  }

  async deleteScheduleAssignmentsByDateRange(orgId: string, from: Date, to: Date): Promise<number> {
    const runs = await this.getSchedulerRuns(orgId);
    const runIds = runs.map((r) => r.id);
    if (runIds.length === 0) {
      return 0;
    }
    let deletedCount = 0;
    for (const runId of runIds) {
      const deleted = await db
        .delete(scheduleAssignments)
        .where(
          and(
            eq(scheduleAssignments.runId, runId),
            gte(scheduleAssignments.start, from),
            lte(scheduleAssignments.start, to)
          )
        )
        .returning();
      deletedCount += deleted.length;
    }
    return deletedCount;
  }

  async getSchedulerRunsByStatus(
    orgId: string,
    status: string,
    limit?: number
  ): Promise<SchedulerRun[]> {
    return this.getSchedulerRuns(orgId, status, limit);
  }

  async approveSchedulerRun(id: string, userId?: string): Promise<SchedulerRun> {
    const [u] = await db
      .update(schedulerRuns)
      .set({
        status: "approved",
        publishedAt: new Date(),
        publishedBy: userId,
        updatedAt: new Date(),
      } as never)
      .where(eq(schedulerRuns.id, id))
      .returning();
    if (!u) {
      throw new Error(`Scheduler run ${id} not found`);
    }
    return u;
  }

  async publishSchedulerRun(id: string, userId: string): Promise<SchedulerRun> {
    const [u] = await db
      .update(schedulerRuns)
      .set({
        status: "published",
        publishedAt: new Date(),
        publishedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(schedulerRuns.id, id))
      .returning();
    if (!u) {
      throw new Error(`Scheduler run ${id} not found`);
    }
    return u;
  }

  async cancelSchedulerRun(id: string, _userId?: string): Promise<SchedulerRun> {
    const [u] = await db
      .update(schedulerRuns)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(schedulerRuns.id, id))
      .returning();
    if (!u) {
      throw new Error(`Scheduler run ${id} not found`);
    }
    return u;
  }

  async getScheduleAssignments(orgId: string, fromDate: Date, toDate: Date) {
    const runs = await this.getSchedulerRuns(orgId);
    const runIds = runs.map((r) => r.id);
    if (runIds.length === 0) {
      return [];
    }
    const allAssignments: Awaited<ReturnType<typeof this.getScheduleAssignmentsByRun>> = [];
    for (const runId of runIds) {
      const assignments = await db
        .select()
        .from(scheduleAssignments)
        .where(
          and(
            eq(scheduleAssignments.runId, runId),
            gte(scheduleAssignments.start, fromDate),
            lte(scheduleAssignments.start, toDate)
          )
        )
        .orderBy(scheduleAssignments.start);
      allAssignments.push(...assignments);
    }
    return allAssignments;
  }

  async findRecentSchedulerRunByHash(
    orgId: string,
    hash: string,
    hoursBack?: number
  ): Promise<SchedulerRun | null> {
    const conditions = [eq(schedulerRuns.orgId, orgId), eq(schedulerRuns.inputHash, hash)];
    if (hoursBack) {
      const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      conditions.push(gte(schedulerRuns.createdAt, cutoff));
    }
    const [result] = await db
      .select()
      .from(schedulerRuns)
      .where(and(...conditions))
      .orderBy(desc(schedulerRuns.createdAt))
      .limit(1);
    return result ?? null;
  }

  async createBulkScheduleAssignments(
    assignments: Parameters<typeof db.insert<typeof scheduleAssignments>>[0] extends never
      ? never
      : Array<typeof scheduleAssignments.$inferInsert>
  ) {
    if (assignments.length === 0) {
      return [];
    }
    return db.insert(scheduleAssignments).values(assignments).returning();
  }

  async createBulkScheduleUnfilled(unfilled: Array<typeof scheduleUnfilled.$inferInsert>) {
    if (unfilled.length === 0) {
      return [];
    }
    return db.insert(scheduleUnfilled).values(unfilled).returning();
  }

  async getSchedulingSettings(orgId: string): Promise<SelectSchedulingSettings | null> {
    const [result] = await db
      .select()
      .from(schedulingSettings)
      .where(and(eq(schedulingSettings.orgId, orgId), sql`${schedulingSettings.vesselId} IS NULL`))
      .limit(1);
    return result ?? null;
  }

  async getSchedulingSettingsByVessel(
    orgId: string,
    vesselId: string
  ): Promise<SelectSchedulingSettings | null> {
    const [result] = await db
      .select()
      .from(schedulingSettings)
      .where(and(eq(schedulingSettings.orgId, orgId), eq(schedulingSettings.vesselId, vesselId)))
      .limit(1);
    return result ?? null;
  }
}
