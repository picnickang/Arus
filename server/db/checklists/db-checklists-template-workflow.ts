import { and, eq } from "drizzle-orm";
import { db } from "../../db-config";
import { recordAndPublish, publishEvent } from "../../sync-events";
import {
  maintenanceChecklistCompletions,
  maintenanceChecklistItems,
  maintenanceTemplates,
  workOrders,
} from "@shared/schema-runtime";
import type {
  MaintenanceChecklistCompletion,
  MaintenanceChecklistItem,
  MaintenanceTemplate,
  WorkOrder,
} from "@shared/schema";

export class DatabaseChecklistTemplateWorkflowStorage {
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
      if (!cloned) {
        throw new Error("cloneMaintenanceTemplate: clone insert returned no row");
      }
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
      await publishEvent("maintenance_template.created", {
        id: cloned.id,
        data: cloned,
      });
      return cloned;
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
    const wo0 = wo[0];
    if (!wo0 || !wo0.maintenanceTemplateId) {
      return emptyProgress();
    }
    const items = await db
      .select()
      .from(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.templateId, wo0.maintenanceTemplateId));
    const totalItems = items.length;
    if (totalItems === 0) {
      return emptyProgress();
    }
    const completions = await db
      .select()
      .from(maintenanceChecklistCompletions)
      .where(eq(maintenanceChecklistCompletions.workOrderId, workOrderId));
    const completedItems = completions.filter(
      (c) => c.status === "completed" || (c.passed === true && c.completedAt !== null)
    ).length;
    const failedItems = completions.filter(
      (c) => c.status === "failed" || (c.passed === false && c.completedAt !== null)
    ).length;
    const skippedItems = completions.filter((c) => c.status === "skipped").length;
    const pendingItems =
      completions.filter(
        (c) => c.status === "pending" || (c.passed === null && c.completedAt === null)
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
              }) as never
          )
        )
        .returning();
      for (const c of created) {
        await publishEvent("maintenance_checklist_completion.created", {
          id: c.id,
          data: c,
        });
      }
      return created;
    });
  }
}

function emptyProgress(): {
  totalItems: number;
  completedItems: number;
  pendingItems: number;
  skippedItems: number;
  failedItems: number;
  percentComplete: number;
} {
  return {
    totalItems: 0,
    completedItems: 0,
    pendingItems: 0,
    skippedItems: 0,
    failedItems: 0,
    percentComplete: 0,
  };
}
