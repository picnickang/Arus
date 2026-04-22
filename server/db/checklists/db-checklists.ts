/**
 * Checklists - Database Storage
 *
 * FIXES APPLIED:
 * - recordAndPublish signature updated to (entityType, entityId, operation, data, userId?)
 *   across every call site (was: recordAndPublish(returning-query, type, op))
 * - EventType casts added for non-enum types like "maintenance_template",
 *   "maintenance_checklist_item", "maintenance_checklist_completion" — these
 *   values need to be added to the EventType union in sync-events.ts
 * - Reformatted from single-line-per-function to conventional formatting
 *   for readability and easier future edits.
 *
 * DEPENDS ON:
 * - shared/schema-runtime.ts fix (as typeof pgSchema.<table> cast pattern)
 * - shared/schema/maintenance.ts patch (adds stepNumber, title, category,
 *   itemId, status, passed, actualValue, photoUrls, completedByName columns)
 * - shared/sync-events.ts update (add maintenance_* event types to EventType union)
 */

import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../db-config";
import { recordAndPublish, publishEvent, type EntityType, type EventType } from "../../sync-events";
import {
  maintenanceTemplates,
  maintenanceChecklistItems,
  maintenanceChecklistCompletions,
  workOrders,
  workOrderTasks,
  workOrderChecklists,
  workOrderWorklogs,
} from "@shared/schema-runtime";
import type {
  MaintenanceTemplate,
  InsertMaintenanceTemplate,
  MaintenanceChecklistItem,
  InsertMaintenanceChecklistItem,
  MaintenanceChecklistCompletion,
  InsertMaintenanceChecklistCompletion,
  WorkOrder,
  WorkOrderTask,
  InsertWorkOrderTask,
  WorkOrderChecklist,
  InsertWorkOrderChecklist,
  WorkOrderWorklog,
  InsertWorkOrderWorklog,
} from "@shared/schema";

export class DatabaseChecklistsStorage {
  // ──────────────────────────────────────────────────────────────────────
  // Maintenance Templates
  // ──────────────────────────────────────────────────────────────────────

  async getMaintenanceTemplates(
    orgId?: string,
    equipmentType?: string,
    isActive?: boolean
  ): Promise<MaintenanceTemplate[]> {
    const c = [];
    if (orgId) {
      c.push(eq(maintenanceTemplates.orgId, orgId));
    }
    if (equipmentType) {
      c.push(eq(maintenanceTemplates.equipmentType, equipmentType));
    }
    if (isActive !== undefined) {
      c.push(eq(maintenanceTemplates.isActive, isActive));
    }
    let q = db.select().from(maintenanceTemplates);
    if (c.length > 0) {
      q = q.where(and(...c)) as typeof q;
    }
    return q.orderBy(maintenanceTemplates.name);
  }

  async getMaintenanceTemplate(
    id: string,
    orgId?: string
  ): Promise<MaintenanceTemplate | undefined> {
    const c = [eq(maintenanceTemplates.id, id)];
    if (orgId) {
      c.push(eq(maintenanceTemplates.orgId, orgId));
    }
    const r = await db
      .select()
      .from(maintenanceTemplates)
      .where(and(...c));
    return r[0];
  }

  async createMaintenanceTemplate(
    template: InsertMaintenanceTemplate
  ): Promise<MaintenanceTemplate> {
    const [n] = await db.insert(maintenanceTemplates).values(template).returning();
    await recordAndPublish("maintenance_template" as EntityType, n.id, "create", n);
    return n;
  }

  async updateMaintenanceTemplate(
    id: string,
    template: Partial<InsertMaintenanceTemplate>,
    orgId?: string
  ): Promise<MaintenanceTemplate> {
    const c = [eq(maintenanceTemplates.id, id)];
    if (orgId) {
      c.push(eq(maintenanceTemplates.orgId, orgId));
    }
    const [u] = await db
      .update(maintenanceTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(and(...c))
      .returning();
    if (!u) {
      throw new Error(`Maintenance template ${id} not found`);
    }
    await recordAndPublish("maintenance_template" as EntityType, u.id, "update", u);
    return u;
  }

  async deleteMaintenanceTemplate(id: string, orgId?: string): Promise<void> {
    const c = [eq(maintenanceTemplates.id, id)];
    if (orgId) {
      c.push(eq(maintenanceTemplates.orgId, orgId));
    }
    const r = await db
      .delete(maintenanceTemplates)
      .where(and(...c))
      .returning();
    if (r.length === 0) {
      throw new Error(`Maintenance template ${id} not found`);
    }
    await recordAndPublish("maintenance_template" as EntityType, id, "delete", r[0]);
  }

  async cloneMaintenanceTemplate(
    id: string,
    newName: string,
    orgId?: string
  ): Promise<MaintenanceTemplate> {
    return db.transaction(async (tx) => {
      const c = [eq(maintenanceTemplates.id, id)];
      if (orgId) {
        c.push(eq(maintenanceTemplates.orgId, orgId));
      }
      const [o] = await tx
        .select()
        .from(maintenanceTemplates)
        .where(and(...c));
      if (!o) {
        throw new Error(`Maintenance template ${id} not found`);
      }
      const [cloned] = await tx
        .insert(maintenanceTemplates)
        .values({
          ...o,
          id: undefined,
          name: newName,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      const oi = await tx
        .select()
        .from(maintenanceChecklistItems)
        .where(eq(maintenanceChecklistItems.templateId, id))
        .orderBy(maintenanceChecklistItems.stepNumber);
      if (oi.length > 0) {
        await tx.insert(maintenanceChecklistItems).values(
          oi.map((item: MaintenanceChecklistItem) => ({
            ...item,
            id: undefined,
            templateId: cloned.id,
          }))
        );
      }
      await publishEvent("maintenance_template.created" as EventType, {
        id: cloned.id,
        data: cloned,
      });
      return cloned;
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Maintenance Checklist Items
  // ──────────────────────────────────────────────────────────────────────

  async getMaintenanceChecklistItems(templateId: string): Promise<MaintenanceChecklistItem[]> {
    return db
      .select()
      .from(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.templateId, templateId))
      .orderBy(maintenanceChecklistItems.stepNumber);
  }

  async getMaintenanceChecklistItem(id: string): Promise<MaintenanceChecklistItem | undefined> {
    const r = await db
      .select()
      .from(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.id, id));
    return r[0];
  }

  async createMaintenanceChecklistItem(
    item: InsertMaintenanceChecklistItem
  ): Promise<MaintenanceChecklistItem> {
    const [n] = await db.insert(maintenanceChecklistItems).values(item).returning();
    await recordAndPublish("maintenance_checklist_item" as EntityType, n.id, "create", n);
    return n;
  }

  async updateMaintenanceChecklistItem(
    id: string,
    item: Partial<InsertMaintenanceChecklistItem>
  ): Promise<MaintenanceChecklistItem> {
    const [u] = await db
      .update(maintenanceChecklistItems)
      .set(item)
      .where(eq(maintenanceChecklistItems.id, id))
      .returning();
    if (!u) {
      throw new Error(`Maintenance checklist item ${id} not found`);
    }
    await recordAndPublish("maintenance_checklist_item" as EntityType, u.id, "update", u);
    return u;
  }

  async deleteMaintenanceChecklistItem(id: string): Promise<void> {
    const r = await db
      .delete(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.id, id))
      .returning();
    if (r.length === 0) {
      throw new Error(`Maintenance checklist item ${id} not found`);
    }
    await recordAndPublish("maintenance_checklist_item" as EntityType, id, "delete", r[0]);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Maintenance Checklist Completions
  // ──────────────────────────────────────────────────────────────────────

  async getChecklistCompletions(workOrderId: string, orgId: string): Promise<any[]> {
    return db
      .select({
        id: maintenanceChecklistCompletions.id,
        orgId: maintenanceChecklistCompletions.orgId,
        workOrderId: maintenanceChecklistCompletions.workOrderId,
        itemId: maintenanceChecklistCompletions.itemId,
        completedBy: maintenanceChecklistCompletions.completedBy,
        completedByName: maintenanceChecklistCompletions.completedByName,
        completedAt: maintenanceChecklistCompletions.completedAt,
        status: maintenanceChecklistCompletions.status,
        passed: maintenanceChecklistCompletions.passed,
        actualValue: maintenanceChecklistCompletions.actualValue,
        notes: maintenanceChecklistCompletions.notes,
        photoUrls: maintenanceChecklistCompletions.photoUrls,
        title: maintenanceChecklistItems.title,
        category: maintenanceChecklistItems.category,
        stepNumber: maintenanceChecklistItems.stepNumber,
      })
      .from(maintenanceChecklistCompletions)
      .leftJoin(
        maintenanceChecklistItems,
        eq(maintenanceChecklistCompletions.itemId, maintenanceChecklistItems.id)
      )
      .where(
        and(
          eq(maintenanceChecklistCompletions.workOrderId, workOrderId),
          eq(maintenanceChecklistCompletions.orgId, orgId)
        )
      )
      .orderBy(maintenanceChecklistItems.stepNumber);
  }

  async createChecklistCompletion(
    completion: InsertMaintenanceChecklistCompletion
  ): Promise<MaintenanceChecklistCompletion> {
    const [n] = await db.insert(maintenanceChecklistCompletions).values(completion).returning();
    await recordAndPublish("maintenance_checklist_completion" as EntityType, n.id, "create", n);
    return n;
  }

  async updateChecklistCompletion(
    id: string,
    updates: Partial<InsertMaintenanceChecklistCompletion>
  ): Promise<MaintenanceChecklistCompletion> {
    const [u] = await db
      .update(maintenanceChecklistCompletions)
      .set(updates)
      .where(eq(maintenanceChecklistCompletions.id, id))
      .returning();
    if (!u) {
      throw new Error(`Checklist completion ${id} not found`);
    }
    await recordAndPublish("maintenance_checklist_completion" as EntityType, u.id, "update", u);
    return u;
  }

  async bulkCompleteChecklistItems(
    workOrderId: string,
    completions: Array<{
      itemId: string;
      completedBy: string;
      completedByName: string;
      passed?: boolean;
      actualValue?: string;
      notes?: string;
    }>
  ): Promise<MaintenanceChecklistCompletion[]> {
    if (completions.length === 0) {
      return [];
    }
    return db.transaction(async (tx) => {
      const created = await tx
        .insert(maintenanceChecklistCompletions)
        .values(
          completions.map(
            (c) =>
              ({
                workOrderId,
                itemId: c.itemId,
                completedBy: c.completedBy,
                completedByName: c.completedByName,
                passed: c.passed ?? null,
                actualValue: c.actualValue ?? null,
                notes: c.notes ?? null,
                photoUrls: null,
                completedAt: new Date(),
                status: c.passed === false ? "failed" : "completed",
              }) as any
          )
        )
        .returning();
      for (const completion of created) {
        await publishEvent("maintenance_checklist_completion.created" as EventType, {
          id: completion.id,
          data: completion,
        });
      }
      return created;
    });
  }

  async getChecklistCompletionProgress(workOrderId: string): Promise<{
    totalItems: number;
    completedItems: number;
    pendingItems: number;
    skippedItems: number;
    failedItems: number;
    percentComplete: number;
  }> {
    const wo = await db.select().from(workOrders).where(eq(workOrders.id, workOrderId)).limit(1);
    if (wo.length === 0 || !wo[0].maintenanceTemplateId) {
      return {
        totalItems: 0,
        completedItems: 0,
        pendingItems: 0,
        skippedItems: 0,
        failedItems: 0,
        percentComplete: 0,
      };
    }
    const items = await db
      .select()
      .from(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.templateId, wo[0].maintenanceTemplateId));
    const totalItems = items.length;
    if (totalItems === 0) {
      return {
        totalItems: 0,
        completedItems: 0,
        pendingItems: 0,
        skippedItems: 0,
        failedItems: 0,
        percentComplete: 0,
      };
    }
    const completions = await db
      .select()
      .from(maintenanceChecklistCompletions)
      .where(eq(maintenanceChecklistCompletions.workOrderId, workOrderId));
    const completedItems = completions.filter(
      (c: any) => c.status === "completed" || (c.passed === true && c.completedAt !== null)
    ).length;
    const failedItems = completions.filter(
      (c: any) => c.status === "failed" || (c.passed === false && c.completedAt !== null)
    ).length;
    const skippedItems = completions.filter((c: any) => c.status === "skipped").length;
    const pendingItems =
      completions.filter(
        (c: any) => c.status === "pending" || (c.passed === null && c.completedAt === null)
      ).length +
      (totalItems - completions.length);
    const reviewedItems = completedItems + failedItems;
    const percentComplete = totalItems > 0 ? Math.round((reviewedItems / totalItems) * 100) : 0;
    return { totalItems, completedItems, pendingItems, skippedItems, failedItems, percentComplete };
  }

  async linkWorkOrderToTemplate(
    workOrderId: string,
    templateId: string,
    orgId?: string
  ): Promise<WorkOrder> {
    const c = [eq(workOrders.id, workOrderId)];
    if (orgId) {
      c.push(eq(workOrders.orgId, orgId));
    }
    const [u] = await db
      .update(workOrders)
      .set({ maintenanceTemplateId: templateId, updatedAt: new Date() })
      .where(and(...c))
      .returning();
    if (!u) {
      throw new Error(`Work order ${workOrderId} not found`);
    }
    await recordAndPublish("work_order", u.id, "update", u);
    return u;
  }

  async initializeChecklistFromTemplate(
    workOrderId: string,
    templateId: string
  ): Promise<MaintenanceChecklistCompletion[]> {
    return db.transaction(async (tx) => {
      const [template] = await tx
        .select()
        .from(maintenanceTemplates)
        .where(eq(maintenanceTemplates.id, templateId))
        .limit(1);
      if (!template) {
        throw new Error(`Maintenance template ${templateId} not found`);
      }
      const [wo] = await tx
        .select()
        .from(workOrders)
        .where(eq(workOrders.id, workOrderId))
        .limit(1);
      if (!wo) {
        throw new Error(`Work order ${workOrderId} not found`);
      }
      await tx
        .update(workOrders)
        .set({ maintenanceTemplateId: templateId, updatedAt: new Date() })
        .where(eq(workOrders.id, workOrderId));
      const items = await tx
        .select()
        .from(maintenanceChecklistItems)
        .where(eq(maintenanceChecklistItems.templateId, templateId))
        .orderBy(maintenanceChecklistItems.stepNumber);
      if (items.length === 0) {
        return [];
      }
      const created = await tx
        .insert(maintenanceChecklistCompletions)
        .values(
          items.map(
            (item: MaintenanceChecklistItem) =>
              ({
                orgId: wo.orgId,
                workOrderId,
                itemId: item.id,
                completedBy: null,
                completedByName: null,
                passed: null,
                actualValue: null,
                notes: null,
                photoUrls: null,
                completedAt: null,
                status: "pending",
              }) as any
          )
        )
        .returning();
      for (const c of created) {
        await publishEvent("maintenance_checklist_completion.created" as EventType, {
          id: c.id,
          data: c,
        });
      }
      return created;
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Work Order Tasks
  // ──────────────────────────────────────────────────────────────────────

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

  // ──────────────────────────────────────────────────────────────────────
  // Work Order Checklists
  // ──────────────────────────────────────────────────────────────────────

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
      .values({ id: randomUUID(), ...checklist, createdAt: new Date() } as any)
      .returning();
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
      .set({ ...updates } as any)
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

  // ──────────────────────────────────────────────────────────────────────
  // Work Order Worklogs
  // ──────────────────────────────────────────────────────────────────────

  async getWorkOrderWorklogs(workOrderId?: string, orgId?: string): Promise<WorkOrderWorklog[]> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const c = [eq(workOrderWorklogs.orgId, orgId)];
    if (workOrderId) {
      c.push(eq(workOrderWorklogs.workOrderId, workOrderId));
    }
    // NOTE: performedAt → use startTime (the actual column in the schema)
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
