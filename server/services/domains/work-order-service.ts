/**
 * Work Order Service
 * Encapsulates complex work order business logic (downtime tracking, inventory, etc.)
 * Consumes repositories for basic CRUD, handles orchestration and transactions
 */

import { eq, and, or, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db-config";
import {
  workOrders,
  equipment,
  vessels,
  workOrderParts,
  stock,
  type WorkOrder,
  type InsertWorkOrder,
  type WorkOrderPart,
} from "@shared/schema-runtime";
import { dbWorkOrderStorage } from "../../db/workorders/index.js";
import { getWebSocketServer } from "../../websocket-server";
import { ilike } from "../../utils/sql-compat";
export interface WorkOrderFilters {
  vesselId?: string;
  assignedCrewId?: string;
  status?: string;
  priority?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  equipmentCategory?: string;
  search?: string;
  workOrderType?: string; // routine, defect, service_request, certificate_renewal
}

export interface WorkOrderWithDetails extends WorkOrder {
  equipmentName?: string | null;
  equipmentType?: string | null;
  vesselName?: string | null;
}

export interface WorkOrderPaginationResult {
  items: WorkOrderWithDetails[];
  total: number;
}

class WorkOrderService {
  async getWorkOrdersWithDetails(
    equipmentId?: string,
    orgId?: string,
    filters?: WorkOrderFilters
  ): Promise<WorkOrderWithDetails[]> {
    try {
      const query = db
        .select({
          ...workOrders,
          equipmentName: equipment.name,
          equipmentType: equipment.type,
          vesselName: vessels.name,
        })
        .from(workOrders)
        .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id))
        .leftJoin(vessels, eq(workOrders.vesselId, vessels.id))
        .orderBy(sql`${workOrders.createdAt} DESC`);

      const conditions: any[] = [];
      if (equipmentId) { conditions.push(eq(workOrders.equipmentId, equipmentId)); }
      if (orgId) { conditions.push(eq(workOrders.orgId, orgId)); }
      if (filters?.vesselId) { conditions.push(eq(workOrders.vesselId, filters.vesselId)); }
      if (filters?.assignedCrewId) { conditions.push(eq(workOrders.assignedCrewId, filters.assignedCrewId)); }
      if (filters?.status && filters.status !== "all") { conditions.push(eq(workOrders.status, filters.status)); }
      if (filters?.priority && filters.priority !== "all") { conditions.push(eq(workOrders.priority, Number.parseInt(filters.priority, 10))); }
      if (filters?.dueDateFrom) { conditions.push(gte(workOrders.plannedEndDate, filters.dueDateFrom)); }
      if (filters?.dueDateTo) { conditions.push(lte(workOrders.plannedEndDate, filters.dueDateTo)); }
      if (filters?.equipmentCategory && filters.equipmentCategory !== "all") { conditions.push(eq(equipment.type, filters.equipmentCategory)); }
      if (filters?.workOrderType && filters.workOrderType !== "all") { conditions.push(eq(workOrders.workOrderType, filters.workOrderType)); }
      if (filters?.search?.trim()) {
        const term = `%${filters.search.trim().toLowerCase()}%`;
        conditions.push(or(ilike(workOrders.reason, term), ilike(workOrders.description, term), ilike(workOrders.woNumber, term)));
      }

      const results = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

      return results.map((wo) => {
        if (!wo.woNumber) {
          const year = wo.createdAt ? new Date(wo.createdAt).getFullYear() : new Date().getFullYear();
          const ts = wo.createdAt ? new Date(wo.createdAt).getTime() : Date.now();
          return { ...wo, woNumber: `WO-${year}-${String(Math.abs(ts % 10000)).padStart(4, "0")}` };
        }
        return wo;
      });
    } catch (error) {
      console.error("[WorkOrderService.getWorkOrdersWithDetails] Error:", error);
      throw error;
    }
  }

  async getWorkOrdersPaginated(
    equipmentId: string | undefined,
    orgId: string | undefined,
    limit: number,
    offset: number,
    filters?: WorkOrderFilters
  ): Promise<WorkOrderPaginationResult> {
    try {
      const conditions: any[] = [];
      if (equipmentId) { conditions.push(eq(workOrders.equipmentId, equipmentId)); }
      if (orgId) { conditions.push(eq(workOrders.orgId, orgId)); }
      if (filters?.vesselId) { conditions.push(eq(workOrders.vesselId, filters.vesselId)); }
      if (filters?.assignedCrewId) { conditions.push(eq(workOrders.assignedCrewId, filters.assignedCrewId)); }
      if (filters?.status && filters.status !== "all") { conditions.push(eq(workOrders.status, filters.status)); }
      if (filters?.priority && filters.priority !== "all") { conditions.push(eq(workOrders.priority, Number.parseInt(filters.priority, 10))); }
      if (filters?.dueDateFrom) { conditions.push(gte(workOrders.plannedEndDate, filters.dueDateFrom)); }
      if (filters?.dueDateTo) { conditions.push(lte(workOrders.plannedEndDate, filters.dueDateTo)); }
      if (filters?.equipmentCategory && filters.equipmentCategory !== "all") { conditions.push(eq(equipment.type, filters.equipmentCategory)); }
      if (filters?.workOrderType && filters.workOrderType !== "all") { conditions.push(eq(workOrders.workOrderType, filters.workOrderType)); }
      if (filters?.search?.trim()) {
        const term = `%${filters.search.trim().toLowerCase()}%`;
        conditions.push(or(ilike(workOrders.reason, term), ilike(workOrders.description, term), ilike(workOrders.woNumber, term)));
      }

      const countQuery = db.select({ count: sql<number>`count(*)` }).from(workOrders).leftJoin(equipment, eq(workOrders.equipmentId, equipment.id));
      const countResult = conditions.length > 0 ? await countQuery.where(and(...conditions)) : await countQuery;
      const total = Number(countResult[0]?.count ?? 0);

      const query = db
        .select({
          ...workOrders,
          equipmentName: equipment.name,
          equipmentType: equipment.type,
          vesselName: vessels.name,
        })
        .from(workOrders)
        .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id))
        .leftJoin(vessels, eq(workOrders.vesselId, vessels.id))
        .orderBy(sql`${workOrders.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      const results = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

      const items = results.map((wo) => {
        if (!wo.woNumber) {
          const year = wo.createdAt ? new Date(wo.createdAt).getFullYear() : new Date().getFullYear();
          const ts = wo.createdAt ? new Date(wo.createdAt).getTime() : Date.now();
          return { ...wo, woNumber: `WO-${year}-${String(Math.abs(ts % 10000)).padStart(4, "0")}` };
        }
        return wo;
      });

      return { items, total };
    } catch (error) {
      console.error("[WorkOrderService.getWorkOrdersPaginated] Error:", error);
      throw error;
    }
  }

  async updateWorkOrderWithDowntimeTracking(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    const updatedOrder = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
      if (!existing) { throw new Error(`Work order ${id} not found`); }

      const postUpdateOrder = { ...existing, ...updates };
      const finalUpdates: any = { ...updates };
      const shouldTrackDowntime = postUpdateOrder.affectsVesselDowntime && postUpdateOrder.equipmentId;

      if (shouldTrackDowntime) {
        const [equipmentResult] = await tx.select().from(equipment).where(eq(equipment.id, postUpdateOrder.equipmentId)).limit(1);
        if (equipmentResult?.vesselId) {
          const vesselId = equipmentResult.vesselId;
          const oldStatus = existing.status;
          const newStatus = postUpdateOrder.status;

          if (newStatus === "in_progress" && oldStatus !== "in_progress" && !postUpdateOrder.vesselDowntimeStartedAt) {
            finalUpdates.vesselDowntimeStartedAt = new Date();
          } else if (newStatus === "completed" && oldStatus === "in_progress" && existing.vesselDowntimeStartedAt) {
            const startTime = new Date(existing.vesselDowntimeStartedAt);
            const endTime = new Date();
            const downtimeHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
            const downtimeDays = downtimeHours / 24;

            const [vessel] = await tx.select().from(vessels).where(eq(vessels.id, vesselId)).limit(1);
            if (vessel) {
              const currentDowntime = Number.parseFloat(vessel.downtimeDays ?? "0");
              await tx.update(vessels).set({ downtimeDays: (currentDowntime + downtimeDays).toFixed(2), updatedAt: new Date() }).where(eq(vessels.id, vesselId));
            }
            finalUpdates.vesselDowntimeStartedAt = null;
          }
        }
      }

      const [result] = await tx.update(workOrders).set(finalUpdates).where(eq(workOrders.id, id)).returning();
      if (!result) { throw new Error(`Work order ${id} not found`); }
      return result;
    });

    const wsServer = getWebSocketServer();
    wsServer?.broadcastWorkOrderChange("update", updatedOrder);
    return updatedOrder;
  }

  async closeWorkOrderWithInventoryRelease(id: string, closeData: { notes?: string; completedBy?: string }): Promise<WorkOrder> {
    const closedOrder = await db.transaction(async (tx) => {
      const parts = await tx.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, id));
      const inventoryLocks = await tx.select().from(stock).where(sql`${stock.partId} IN (SELECT part_id FROM work_order_parts WHERE work_order_id = ${id})`).orderBy(stock.id);

      for (const part of parts) {
        if (part.usedQuantity !== undefined && part.usedQuantity > 0 && part.partId) {
          const [stockRow] = await tx.select().from(stock).where(eq(stock.partId, part.partId)).limit(1);
          if (stockRow) {
            const currentReserved = stockRow.quantityReserved ?? 0;
            const released = Math.min(currentReserved, part.usedQuantity);
            await tx.update(stock).set({ quantityReserved: currentReserved - released, updatedAt: new Date() }).where(eq(stock.partId, part.partId));
          }
        }
      }

      const [result] = await tx.update(workOrders).set({ status: "completed", actualEndDate: new Date(), description: closeData.notes ? `${closeData.notes}` : undefined, updatedAt: new Date() }).where(eq(workOrders.id, id)).returning();
      if (!result) { throw new Error(`Work order ${id} not found`); }
      return result;
    });

    const wsServer = getWebSocketServer();
    wsServer?.broadcastWorkOrderChange("update", closedOrder);
    return closedOrder;
  }

  async generateWorkOrderNumber(orgId: string): Promise<string> {
    return dbWorkOrderStorage.generateWorkOrderNumber(orgId);
  }

  async getWorkOrder(orgId: string, workOrderId: string): Promise<WorkOrder | undefined> {
    return dbWorkOrderStorage.getWorkOrder(orgId, workOrderId);
  }

  async getWorkOrderById(id: string, orgId: string): Promise<WorkOrder | undefined> {
    return dbWorkOrderStorage.getWorkOrderById(id, orgId);
  }

  async createWorkOrder(order: InsertWorkOrder & { woNumber?: string; id?: string }): Promise<WorkOrder> {
    return dbWorkOrderStorage.createWorkOrder(order);
  }

  async deleteWorkOrder(id: string): Promise<void> {
    return dbWorkOrderStorage.deleteWorkOrder(id);
  }

  async getWorkOrderParts(workOrderId: string): Promise<WorkOrderPart[]> {
    return dbWorkOrderStorage.getWorkOrderParts(workOrderId);
  }

  async getWorkOrderTasks(workOrderId: string) {
    return dbWorkOrderStorage.getWorkOrderTasks(workOrderId);
  }

  async getWorkOrderChecklists(workOrderId: string) {
    return dbWorkOrderStorage.getWorkOrderChecklists(workOrderId);
  }

  async getWorkOrderWorklogs(workOrderId: string) {
    return dbWorkOrderStorage.getWorkOrderWorklogs(workOrderId);
  }
}

export const workOrderService = new WorkOrderService();
