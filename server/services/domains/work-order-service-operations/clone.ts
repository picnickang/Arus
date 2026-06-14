import { and, eq } from "drizzle-orm";
import type { WorkOrder } from "@shared/schema";
import { workOrderParts, workOrders, workOrderTasks } from "@shared/schema-runtime";
import { publishEvent } from "../../../sync-events.js";
import type { WorkOrderCloneOptions, WorkOrderDb } from "./types";

export async function cloneWorkOrder(
  db: WorkOrderDb,
  id: string,
  orgId: string,
  generateWorkOrderNumber: (orgId: string) => Promise<string>,
  options?: WorkOrderCloneOptions
): Promise<WorkOrder> {
  // LR-3.5 / TX-1: publish `work_order.created` strictly after the clone
  // transaction commits, so subscribers never observe a rolled-back clone.
  const clonedOrder = await db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.orgId, orgId)));
    if (!original) {
      throw new Error(`Work order ${id} not found`);
    }
    const newWoNumber = await generateWorkOrderNumber(orgId);
    const now = new Date();
    const [clonedOrder] = await tx
      .insert(workOrders)
      .values({
        ...original,
        id: undefined,
        woNumber: newWoNumber,
        status: "open",
        plannedStartDate: options?.plannedStartDate ?? original.plannedStartDate,
        plannedEndDate: options?.plannedEndDate ?? original.plannedEndDate,
        actualStartDate: null,
        actualEndDate: null,
        actualHours: null,
        actualDowntimeHours: null,
        totalPartsCost: 0,
        totalLaborCost: 0,
        totalCost: 0,
        laborHours: null,
        laborCost: null,
        vesselDowntimeStartedAt: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!clonedOrder) {
      throw new Error("cloneWorkOrder: insert returned no row");
    }
    if (options?.includeTasks !== false) {
      const originalTasks = await tx
        .select()
        .from(workOrderTasks)
        .where(eq(workOrderTasks.workOrderId, id));
      if (originalTasks.length > 0) {
        await tx.insert(workOrderTasks).values(
          originalTasks.map((t) => ({
            ...t,
            id: undefined,
            workOrderId: clonedOrder.id,
            isCompleted: false,
            completedAt: null,
            completedBy: null,
            completedByName: null,
            createdAt: now,
            updatedAt: now,
          }))
        );
      }
    }
    if (options?.includeParts !== false) {
      const originalParts = await tx
        .select()
        .from(workOrderParts)
        .where(eq(workOrderParts.workOrderId, id));
      if (originalParts.length > 0) {
        await tx.insert(workOrderParts).values(
          originalParts.map((p) => ({
            ...p,
            id: undefined,
            workOrderId: clonedOrder.id,
            quantityUsed: 0,
            totalCost: 0,
            createdAt: now,
          }))
        );
      }
    }
    return clonedOrder;
  });
  await publishEvent("work_order.created", { ...clonedOrder } as Record<string, unknown>);
  return clonedOrder;
}
