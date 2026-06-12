import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../db-config";
import {
  workOrderChecklists,
  workOrderTasks,
  workOrderWorklogs,
} from "@shared/schema-runtime";
import type {
  InsertWorkOrderChecklist,
  InsertWorkOrderTask,
  InsertWorkOrderWorklog,
  WorkOrderChecklist,
  WorkOrderTask,
  WorkOrderWorklog,
} from "@shared/schema";
import { DatabaseChecklistTemplateWorkflowStorage } from "./db-checklists-template-workflow.js";

export class DatabaseChecklistWorkOrderRecordsStorage extends DatabaseChecklistTemplateWorkflowStorage {
  async getWorkOrderTasks(workOrderId: string, orgId?: string): Promise<WorkOrderTask[]> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    return db
      .select()
      .from(workOrderTasks)
      .where(and(eq(workOrderTasks.workOrderId, workOrderId), eq(workOrderTasks.orgId, orgId)))
      .orderBy(workOrderTasks.sortOrder);
  }

  async createWorkOrderTask(task: InsertWorkOrderTask): Promise<WorkOrderTask> {
    if (!task.orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const [n] = await db
      .insert(workOrderTasks)
      .values({ id: randomUUID(), ...task, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    if (!n) {
      throw new Error("createWorkOrderTask: no row returned");
    }
    return n;
  }

  async updateWorkOrderTask(
    id: string,
    updates: Partial<InsertWorkOrderTask>,
    orgId?: string
  ): Promise<WorkOrderTask> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const [u] = await db
      .update(workOrderTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(workOrderTasks.id, id), eq(workOrderTasks.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Work order task ${id} not found`);
    }
    return u;
  }

  async deleteWorkOrderTask(id: string, orgId?: string): Promise<void> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    await db
      .delete(workOrderTasks)
      .where(and(eq(workOrderTasks.id, id), eq(workOrderTasks.orgId, orgId)));
  }

  async getWorkOrderChecklists(
    workOrderId?: string,
    orgId?: string
  ): Promise<WorkOrderChecklist[]> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const c = [eq(workOrderChecklists.orgId, orgId)];
    if (workOrderId) {
      c.push(eq(workOrderChecklists.workOrderId, workOrderId));
    }
    // Note: workOrderChecklists uses createdAt for ordering (sortOrder not present in shared schema).
    return db
      .select()
      .from(workOrderChecklists)
      .where(and(...c))
      .orderBy(workOrderChecklists.createdAt);
  }

  async createWorkOrderChecklist(checklist: InsertWorkOrderChecklist): Promise<WorkOrderChecklist> {
    if (!checklist.orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const [n] = await db
      .insert(workOrderChecklists)
      .values({ id: randomUUID(), ...checklist, createdAt: new Date() } as never)
      .returning();
    if (!n) {
      throw new Error("createWorkOrderChecklist: no row returned");
    }
    return n;
  }

  async updateWorkOrderChecklist(
    id: string,
    updates: Partial<InsertWorkOrderChecklist>,
    orgId?: string
  ): Promise<WorkOrderChecklist> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const [u] = await db
      .update(workOrderChecklists)
      .set({ ...updates } as never)
      .where(and(eq(workOrderChecklists.id, id), eq(workOrderChecklists.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Work order checklist ${id} not found`);
    }
    return u;
  }

  async deleteWorkOrderChecklist(id: string, orgId?: string): Promise<void> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    await db
      .delete(workOrderChecklists)
      .where(and(eq(workOrderChecklists.id, id), eq(workOrderChecklists.orgId, orgId)));
  }

  async getWorkOrderWorklogs(workOrderId?: string, orgId?: string): Promise<WorkOrderWorklog[]> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const c = [eq(workOrderWorklogs.orgId, orgId)];
    if (workOrderId) {
      c.push(eq(workOrderWorklogs.workOrderId, workOrderId));
    }
    // NOTE: performedAt -> use startTime (the actual column in the schema)
    return db
      .select()
      .from(workOrderWorklogs)
      .where(and(...c))
      .orderBy(desc(workOrderWorklogs.startTime));
  }

  async createWorkOrderWorklog(worklog: InsertWorkOrderWorklog): Promise<WorkOrderWorklog> {
    if (!worklog.orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const [n] = await db
      .insert(workOrderWorklogs)
      .values({ id: randomUUID(), ...worklog, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    if (!n) {
      throw new Error("createWorkOrderWorklog: no row returned");
    }
    return n;
  }

  async updateWorkOrderWorklog(
    id: string,
    updates: Partial<InsertWorkOrderWorklog>,
    orgId?: string
  ): Promise<WorkOrderWorklog> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const [u] = await db
      .update(workOrderWorklogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(workOrderWorklogs.id, id), eq(workOrderWorklogs.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Work order worklog ${id} not found`);
    }
    return u;
  }

  async deleteWorkOrderWorklog(id: string, orgId?: string): Promise<void> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    await db
      .delete(workOrderWorklogs)
      .where(and(eq(workOrderWorklogs.id, id), eq(workOrderWorklogs.orgId, orgId)));
  }

  async calculateWorklogCosts(
    workOrderId: string,
    orgId?: string
  ): Promise<{ totalLaborHours: number; totalLaborCost: number }> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const logs = await db
      .select()
      .from(workOrderWorklogs)
      .where(
        and(eq(workOrderWorklogs.workOrderId, workOrderId), eq(workOrderWorklogs.orgId, orgId))
      );
    let totalLaborHours = 0;
    let totalLaborCost = 0;
    for (const log of logs) {
      // NOTE: work_order_worklogs schema uses durationMinutes (not hoursWorked)
      //       and totalLaborCost (not laborCost). Adjusted accordingly.
      const hours = (log.durationMinutes ?? 0) / 60;
      totalLaborHours += hours;
      totalLaborCost += log.totalLaborCost ?? 0;
    }
    return { totalLaborHours, totalLaborCost };
  }
}
