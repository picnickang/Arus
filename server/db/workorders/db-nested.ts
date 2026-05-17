// @ts-nocheck
/**
 * Work Orders - Database Storage Nested Resources (Parts, Tasks, Checklists, Worklogs)
 */

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db-config";
import {
  workOrderParts,
  workOrderTasks,
  workOrderChecklists,
  workOrderWorklogs,
} from "@shared/schema-runtime";
import type {
  WorkOrderPart,
  InsertWorkOrderParts as InsertWorkOrderPart,
  WorkOrderTask,
  InsertWorkOrderTask,
  WorkOrderChecklist,
  InsertWorkOrderChecklist,
  WorkOrderWorklog,
  InsertWorkOrderWorklog,
} from "@shared/schema";

export class DbWorkOrderNested {
  async getWorkOrderParts(workOrderId: string, orgId?: string): Promise<WorkOrderPart[]> {
    if (orgId) {
      return db
        .select()
        .from(workOrderParts)
        .where(eq(workOrderParts.workOrderId, workOrderId))
        .then((parts) => parts.filter((p) => p.orgId === orgId));
    }
    return db.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, workOrderId));
  }
  async addWorkOrderPart(part: InsertWorkOrderPart): Promise<WorkOrderPart> {
    const [newPart] = await db
      .insert(workOrderParts)
      .values({ id: randomUUID(), ...part, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return newPart;
  }
  async updateWorkOrderPart(
    id: string,
    updates: Partial<InsertWorkOrderPart>
  ): Promise<WorkOrderPart> {
    const [updated] = await db
      .update(workOrderParts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workOrderParts.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Work order part ${id} not found`);
    }
    return updated;
  }
  async deleteWorkOrderPart(id: string): Promise<void> {
    await db.delete(workOrderParts).where(eq(workOrderParts.id, id));
  }

  async getWorkOrderTasks(workOrderId: string): Promise<WorkOrderTask[]> {
    return db
      .select()
      .from(workOrderTasks)
      .where(eq(workOrderTasks.workOrderId, workOrderId))
      .orderBy(workOrderTasks.sortOrder);
  }
  async addWorkOrderTask(task: InsertWorkOrderTask): Promise<WorkOrderTask> {
    const [newTask] = await db
      .insert(workOrderTasks)
      .values({ id: randomUUID(), ...task, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return newTask;
  }
  async updateWorkOrderTask(
    id: string,
    updates: Partial<InsertWorkOrderTask>
  ): Promise<WorkOrderTask> {
    const [updated] = await db
      .update(workOrderTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workOrderTasks.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Work order task ${id} not found`);
    }
    return updated;
  }
  async deleteWorkOrderTask(id: string): Promise<void> {
    await db.delete(workOrderTasks).where(eq(workOrderTasks.id, id));
  }

  async getWorkOrderChecklists(workOrderId: string): Promise<WorkOrderChecklist[]> {
    return db
      .select()
      .from(workOrderChecklists)
      .where(eq(workOrderChecklists.workOrderId, workOrderId))
      .orderBy(workOrderChecklists.sortOrder);
  }
  async addWorkOrderChecklist(checklist: InsertWorkOrderChecklist): Promise<WorkOrderChecklist> {
    const [newChecklist] = await db
      .insert(workOrderChecklists)
      .values({ id: randomUUID(), ...checklist, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return newChecklist;
  }
  async updateWorkOrderChecklist(
    id: string,
    updates: Partial<InsertWorkOrderChecklist>
  ): Promise<WorkOrderChecklist> {
    const [updated] = await db
      .update(workOrderChecklists)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workOrderChecklists.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Work order checklist ${id} not found`);
    }
    return updated;
  }
  async deleteWorkOrderChecklist(id: string): Promise<void> {
    await db.delete(workOrderChecklists).where(eq(workOrderChecklists.id, id));
  }

  async getWorkOrderWorklogs(workOrderId: string): Promise<WorkOrderWorklog[]> {
    return db
      .select()
      .from(workOrderWorklogs)
      .where(eq(workOrderWorklogs.workOrderId, workOrderId))
      .orderBy(sql`${workOrderWorklogs.performedAt} DESC`);
  }
  async addWorkOrderWorklog(worklog: InsertWorkOrderWorklog): Promise<WorkOrderWorklog> {
    const [newWorklog] = await db
      .insert(workOrderWorklogs)
      .values({ id: randomUUID(), ...worklog, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return newWorklog;
  }
  async updateWorkOrderWorklog(
    id: string,
    updates: Partial<InsertWorkOrderWorklog>
  ): Promise<WorkOrderWorklog> {
    const [updated] = await db
      .update(workOrderWorklogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workOrderWorklogs.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Work order worklog ${id} not found`);
    }
    return updated;
  }
  async deleteWorkOrderWorklog(id: string): Promise<void> {
    await db.delete(workOrderWorklogs).where(eq(workOrderWorklogs.id, id));
  }
}
