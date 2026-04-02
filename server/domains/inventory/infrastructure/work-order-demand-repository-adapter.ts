import { db } from "../../../db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { workOrders, workOrderParts } from "@shared/schema";
import type { IWorkOrderDemandRepository, WorkOrderPartDemand } from "../domain/ports";

export class WorkOrderDemandRepositoryAdapter implements IWorkOrderDemandRepository {
  async getUpcomingDemand(orgId: string, daysAhead = 30, vesselId?: string): Promise<WorkOrderPartDemand[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    const openStatuses = ["open", "in_progress", "pending", "planned", "scheduled"];

    const now = new Date();

    const conditions = [
      eq(workOrders.orgId, orgId),
      inArray(workOrders.status, openStatuses),
      sql`(${workOrders.plannedStartDate} IS NOT NULL AND ${workOrders.plannedStartDate} >= ${now} AND ${workOrders.plannedStartDate} <= ${cutoffDate})`,
    ];

    if (vesselId) {
      conditions.push(eq(workOrders.vesselId, vesselId));
    }

    const rows = await db
      .select({
        partId: workOrderParts.partId,
        workOrderId: workOrderParts.workOrderId,
        woNumber: workOrders.woNumber,
        quantityRequired: workOrderParts.quantityUsed,
        plannedStartDate: workOrders.plannedStartDate,
        priority: workOrders.priority,
        status: workOrders.status,
      })
      .from(workOrderParts)
      .innerJoin(workOrders, eq(workOrderParts.workOrderId, workOrders.id))
      .where(and(...conditions));

    return rows.map((r) => ({
      partId: r.partId,
      workOrderId: r.workOrderId,
      woNumber: r.woNumber,
      quantityRequired: r.quantityRequired ?? 0,
      plannedStartDate: r.plannedStartDate,
      priority: r.priority,
      status: r.status,
    }));
  }
}

export const workOrderDemandRepository = new WorkOrderDemandRepositoryAdapter();
