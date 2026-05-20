/**
 * Work Order Service
 * Encapsulates complex work order business logic (downtime tracking, inventory, etc.)
 * Consumes repositories for basic CRUD, handles orchestration and transactions
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:Domains:WorkOrderService");
import { eq, and, or, gte, lte, sql, getTableColumns } from "drizzle-orm";
import { db } from "../../db-config";
import {
  workOrders,
  equipment,
  vessels,
  workOrderParts,
  workOrderChecklists,
  workOrderWorklogs,
  workOrderTasks,
  maintenanceCosts,
  stock,
  inventoryMovements,
} from "@shared/schema-runtime";
import type {
  WorkOrder,
  InsertWorkOrder,
  WorkOrderPart,
  WorkOrderCompletion,
  InsertWorkOrderCompletion,
} from "@shared/schema";
import { publishEvent } from "../../sync-events.js";
import { dbWorkOrderStorage } from "../../db/workorders/index.js";
import { dbInventoryStorage } from "../../db/inventory/index.js";
import {
  fireInventoryMovementProjections,
  type PendingMovementProjection,
} from "../../db/inventory/index.js";
import { randomUUID } from "node:crypto";
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
      const baseQuery = db
        .select({
          ...getTableColumns(workOrders),
          equipmentName: equipment.name,
          equipmentType: equipment.type,
          vesselName: vessels.name,
        })
        .from(workOrders)
        .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id))
        .leftJoin(vessels, eq(workOrders.vesselId, vessels.id));

      const conditions: any[] = [];
      if (equipmentId) {
        conditions.push(eq(workOrders.equipmentId, equipmentId));
      }
      if (orgId) {
        conditions.push(eq(workOrders.orgId, orgId));
      }
      if (filters?.vesselId) {
        conditions.push(eq(workOrders.vesselId, filters.vesselId));
      }
      if (filters?.assignedCrewId) {
        conditions.push(eq(workOrders.assignedCrewId, filters.assignedCrewId));
      }
      if (filters?.status && filters.status !== "all") {
        conditions.push(eq(workOrders.status, filters.status));
      }
      if (filters?.priority && filters.priority !== "all") {
        conditions.push(eq(workOrders.priority, Number.parseInt(filters.priority, 10)));
      }
      if (filters?.dueDateFrom) {
        conditions.push(gte(workOrders.plannedEndDate, filters.dueDateFrom));
      }
      if (filters?.dueDateTo) {
        conditions.push(lte(workOrders.plannedEndDate, filters.dueDateTo));
      }
      if (filters?.equipmentCategory && filters.equipmentCategory !== "all") {
        conditions.push(eq(equipment.type, filters.equipmentCategory));
      }
      if (filters?.workOrderType && filters.workOrderType !== "all") {
        conditions.push(eq(workOrders.workOrderType, filters.workOrderType));
      }
      if (filters?.search?.trim()) {
        const term = `%${filters.search.trim().toLowerCase()}%`;
        conditions.push(
          or(
            ilike(workOrders.reason, term),
            ilike(workOrders.description, term),
            ilike(workOrders.woNumber, term)
          )
        );
      }

      const filtered =
        conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
      const results = await filtered.orderBy(sql`${workOrders.createdAt} DESC`);

      return (results as unknown as WorkOrderWithDetails[]).map((wo) => {
        if (!wo.woNumber) {
          const year = wo.createdAt
            ? new Date(wo.createdAt).getFullYear()
            : new Date().getFullYear();
          const ts = wo.createdAt ? new Date(wo.createdAt).getTime() : Date.now();
          return { ...wo, woNumber: `WO-${year}-${String(Math.abs(ts % 10000)).padStart(4, "0")}` };
        }
        return wo;
      });
    } catch (error) {
      logger.error("[WorkOrderService.getWorkOrdersWithDetails] Error:", undefined, error);
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
      if (equipmentId) {
        conditions.push(eq(workOrders.equipmentId, equipmentId));
      }
      if (orgId) {
        conditions.push(eq(workOrders.orgId, orgId));
      }
      if (filters?.vesselId) {
        conditions.push(eq(workOrders.vesselId, filters.vesselId));
      }
      if (filters?.assignedCrewId) {
        conditions.push(eq(workOrders.assignedCrewId, filters.assignedCrewId));
      }
      if (filters?.status && filters.status !== "all") {
        conditions.push(eq(workOrders.status, filters.status));
      }
      if (filters?.priority && filters.priority !== "all") {
        conditions.push(eq(workOrders.priority, Number.parseInt(filters.priority, 10)));
      }
      if (filters?.dueDateFrom) {
        conditions.push(gte(workOrders.plannedEndDate, filters.dueDateFrom));
      }
      if (filters?.dueDateTo) {
        conditions.push(lte(workOrders.plannedEndDate, filters.dueDateTo));
      }
      if (filters?.equipmentCategory && filters.equipmentCategory !== "all") {
        conditions.push(eq(equipment.type, filters.equipmentCategory));
      }
      if (filters?.workOrderType && filters.workOrderType !== "all") {
        conditions.push(eq(workOrders.workOrderType, filters.workOrderType));
      }
      if (filters?.search?.trim()) {
        const term = `%${filters.search.trim().toLowerCase()}%`;
        conditions.push(
          or(
            ilike(workOrders.reason, term),
            ilike(workOrders.description, term),
            ilike(workOrders.woNumber, term)
          )
        );
      }

      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(workOrders)
        .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id));
      const countResult =
        conditions.length > 0 ? await countQuery.where(and(...conditions)) : await countQuery;
      const total = Number(countResult[0]?.count ?? 0);

      const baseQuery = db
        .select({
          ...getTableColumns(workOrders),
          equipmentName: equipment.name,
          equipmentType: equipment.type,
          vesselName: vessels.name,
        })
        .from(workOrders)
        .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id))
        .leftJoin(vessels, eq(workOrders.vesselId, vessels.id));

      const filtered =
        conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
      const results = await filtered
        .orderBy(sql`${workOrders.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      const items = (results as unknown as WorkOrderWithDetails[]).map((wo) => {
        if (!wo.woNumber) {
          const year = wo.createdAt
            ? new Date(wo.createdAt).getFullYear()
            : new Date().getFullYear();
          const ts = wo.createdAt ? new Date(wo.createdAt).getTime() : Date.now();
          return { ...wo, woNumber: `WO-${year}-${String(Math.abs(ts % 10000)).padStart(4, "0")}` };
        }
        return wo;
      });

      return { items, total };
    } catch (error) {
      logger.error("[WorkOrderService.getWorkOrdersPaginated] Error:", undefined, error);
      throw error;
    }
  }

  async updateWorkOrderWithDowntimeTracking(
    id: string,
    updates: Partial<InsertWorkOrder>
  ): Promise<WorkOrder> {
    const updatedOrder = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
      if (!existing) {
        throw new Error(`Work order ${id} not found`);
      }

      const postUpdateOrder = { ...existing, ...updates };
      const finalUpdates: any = { ...updates };
      const shouldTrackDowntime =
        postUpdateOrder.affectsVesselDowntime && postUpdateOrder.equipmentId;

      if (shouldTrackDowntime) {
        const [equipmentResult] = await tx
          .select()
          .from(equipment)
          .where(eq(equipment.id, postUpdateOrder.equipmentId))
          .limit(1);
        if (equipmentResult?.vesselId) {
          const vesselId = equipmentResult.vesselId;
          const oldStatus = existing.status;
          const newStatus = postUpdateOrder.status;

          if (
            newStatus === "in_progress" &&
            oldStatus !== "in_progress" &&
            !postUpdateOrder.vesselDowntimeStartedAt
          ) {
            finalUpdates.vesselDowntimeStartedAt = new Date();
          } else if (
            newStatus === "completed" &&
            oldStatus === "in_progress" &&
            existing.vesselDowntimeStartedAt
          ) {
            const startTime = new Date(existing.vesselDowntimeStartedAt);
            const endTime = new Date();
            const downtimeHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
            const downtimeDays = downtimeHours / 24;

            const [vessel] = await tx
              .select()
              .from(vessels)
              .where(eq(vessels.id, vesselId))
              .limit(1);
            if (vessel) {
              const currentDowntime = Number.parseFloat(vessel.downtimeDays ?? "0");
              await tx
                .update(vessels)
                .set({
                  downtimeDays: (currentDowntime + downtimeDays).toFixed(2),
                  updatedAt: new Date(),
                })
                .where(eq(vessels.id, vesselId));
            }
            finalUpdates.vesselDowntimeStartedAt = null;
          }
        }
      }

      const [result] = await tx
        .update(workOrders)
        .set(finalUpdates)
        .where(eq(workOrders.id, id))
        .returning();
      if (!result) {
        throw new Error(`Work order ${id} not found`);
      }
      return result;
    });

    const wsServer = getWebSocketServer();
    wsServer?.broadcastWorkOrderChange("update", updatedOrder);
    return updatedOrder;
  }

  async closeWorkOrderWithInventoryRelease(
    id: string,
    closeData: { notes?: string; completedBy?: string }
  ): Promise<WorkOrder> {
    const closedOrder = await db.transaction(async (tx) => {
      const parts = await tx
        .select()
        .from(workOrderParts)
        .where(eq(workOrderParts.workOrderId, id));
      const inventoryLocks = await tx
        .select()
        .from(stock)
        .where(
          sql`${stock.partId} IN (SELECT part_id FROM work_order_parts WHERE work_order_id = ${id})`
        )
        .orderBy(stock.id);

      const [wo] = await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
      if (!wo) {
        throw new Error(`Work order ${id} not found`);
      }
      const woOrgId = wo.orgId;

      for (const part of parts) {
        if (part.quantityUsed !== undefined && part.quantityUsed > 0 && part.partId) {
          const stockRows = await tx
            .select()
            .from(stock)
            .where(
              and(
                eq(stock.partId, part.partId),
                eq(stock.orgId, woOrgId!),
                sql`${stock.quantityReserved} > 0`
              )
            )
            .orderBy(sql`${stock.quantityReserved} DESC`);
          let remaining = part.quantityUsed;
          for (const stockRow of stockRows) {
            if (remaining <= 0) {
              break;
            }
            const currentReserved = stockRow.quantityReserved ?? 0;
            const released = Math.min(currentReserved, remaining);
            await tx
              .update(stock)
              .set({ quantityReserved: currentReserved - released, updatedAt: new Date() })
              .where(and(eq(stock.id, stockRow.id), eq(stock.orgId, woOrgId!)));
            remaining -= released;
          }
        }
      }

      const [result] = await tx
        .update(workOrders)
        .set({
          status: "completed",
          actualEndDate: new Date(),
          description: closeData.notes ? `${closeData.notes}` : undefined,
          updatedAt: new Date(),
        })
        .where(eq(workOrders.id, id))
        .returning();
      if (!result) {
        throw new Error(`Work order ${id} not found`);
      }
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

  async createWorkOrder(
    order: InsertWorkOrder & { woNumber?: string; id?: string },
    tx?: typeof db
  ): Promise<WorkOrder> {
    return dbWorkOrderStorage.createWorkOrder(order, tx);
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

  async closeWorkOrder(
    id: string,
    closeData: { notes?: string; completedBy?: string }
  ): Promise<WorkOrder> {
    const closedOrder = await db.transaction(async (tx) => {
      const txParts = await tx
        .select()
        .from(workOrderParts)
        .where(eq(workOrderParts.workOrderId, id));
      const partIds = txParts.map((p) => p.partId);
      const partIdsArray =
        partIds.length > 0
          ? sql`ARRAY[${sql.join(
              partIds.map((pid) => sql`${pid}`),
              sql`, `
            )}]::text[]`
          : sql`ARRAY[]::text[]`;
      await tx
        .select()
        .from(stock)
        .where(sql`${stock.partId} = ANY(${partIdsArray})`)
        .for("update");
      const [workOrder] = await tx
        .select()
        .from(workOrders)
        .where(eq(workOrders.id, id))
        .limit(1)
        .for("update");
      if (!workOrder) {
        throw new Error(`Work order ${id} not found`);
      }
      if (workOrder.status === "completed") {
        throw new Error(`Work order ${id} is already completed`);
      }
      const lockedParts = await tx
        .select()
        .from(workOrderParts)
        .where(eq(workOrderParts.workOrderId, id))
        .for("update");
      const partQuantities = new Map<string, number>();
      for (const part of lockedParts) {
        partQuantities.set(part.partId, (partQuantities.get(part.partId) || 0) + part.quantityUsed);
      }
      for (const [partId, totalQty] of partQuantities.entries()) {
        const stockRows = await tx
          .select()
          .from(stock)
          .where(
            and(
              eq(stock.partId, partId),
              eq(stock.orgId, workOrder.orgId!),
              sql`${stock.quantityReserved} > 0`
            )
          )
          .orderBy(sql`${stock.quantityReserved} DESC`);
        let remaining = totalQty;
        for (const row of stockRows) {
          if (remaining <= 0) {
            break;
          }
          const reserved = row.quantityReserved ?? 0;
          const toRelease = Math.min(remaining, reserved);
          await tx
            .update(stock)
            .set({ quantityReserved: reserved - toRelease, updatedAt: new Date() })
            .where(eq(stock.id, row.id));
          remaining -= toRelease;
        }
      }
      const finalParts = await tx
        .select()
        .from(workOrderParts)
        .where(eq(workOrderParts.workOrderId, id));
      if (finalParts.length !== lockedParts.length) {
        throw new Error(
          `Concurrent modification detected: parts were added to work order ${id} during close operation.`
        );
      }
      const finalUpdates: Partial<InsertWorkOrder> = {
        status: "completed" as const,
        actualEndDate: new Date(),
      };
      if (
        workOrder.affectsVesselDowntime &&
        workOrder.equipmentId &&
        workOrder.vesselDowntimeStartedAt
      ) {
        const eqRes = await tx
          .select()
          .from(equipment)
          .where(eq(equipment.id, workOrder.equipmentId))
          .limit(1);
        if (eqRes.length > 0 && eqRes[0].vesselId) {
          const vesselId = eqRes[0].vesselId;
          const startTime = new Date(workOrder.vesselDowntimeStartedAt);
          const downtimeDays = (new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);
          const vessel = await tx.select().from(vessels).where(eq(vessels.id, vesselId)).limit(1);
          if (vessel.length > 0) {
            const cd = Number.parseFloat(vessel[0].downtimeDays || "0");
            await tx
              .update(vessels)
              .set({ downtimeDays: (cd + downtimeDays).toFixed(2), updatedAt: new Date() })
              .where(eq(vessels.id, vesselId));
          }
          finalUpdates.vesselDowntimeStartedAt = null;
        }
      }
      if (closeData.notes || closeData.completedBy) {
        await tx
          .insert(workOrderWorklogs)
          .values({
            workOrderId: id,
            orgId: workOrder.orgId,
            performedBy: closeData.completedBy || "system",
            laborHours: 0,
            laborCost: 0,
            notes: closeData.notes || "Work order completed",
            performedAt: new Date(),
          } as any);
      }
      const [updated] = await tx
        .update(workOrders)
        .set(finalUpdates)
        .where(eq(workOrders.id, id))
        .returning();
      if (!updated) {
        throw new Error(`Failed to update work order ${id}`);
      }
      return updated;
    });
    const wsServer = getWebSocketServer();
    wsServer?.broadcastWorkOrderChange("update", closedOrder);
    return closedOrder;
  }

  async deleteWorkOrderCascade(id: string): Promise<void> {
    const [wo] = await db
      .select({ orgId: workOrders.orgId })
      .from(workOrders)
      .where(eq(workOrders.id, id))
      .limit(1);
    if (wo?.orgId) {
      await dbInventoryStorage.releasePartsFromWorkOrder(id, wo.orgId);
    }
    await db.delete(workOrderParts).where(eq(workOrderParts.workOrderId, id));
    await db.delete(workOrderChecklists).where(eq(workOrderChecklists.workOrderId, id));
    await db.delete(workOrderWorklogs).where(eq(workOrderWorklogs.workOrderId, id));
    await db.delete(maintenanceCosts).where(eq(maintenanceCosts.workOrderId, id));
    const r = await db.delete(workOrders).where(eq(workOrders.id, id)).returning();
    if (r.length === 0) {
      throw new Error(`Work order ${id} not found`);
    }
    const ws = getWebSocketServer();
    if (r[0]) {
      ws?.broadcastWorkOrderChange("delete", { id: r[0].id });
    }
  }

  async cloneWorkOrder(
    id: string,
    orgId: string,
    options?: {
      plannedStartDate?: Date;
      plannedEndDate?: Date;
      includeTasks?: boolean;
      includeParts?: boolean;
    }
  ): Promise<WorkOrder> {
    return db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(workOrders)
        .where(and(eq(workOrders.id, id), eq(workOrders.orgId, orgId)));
      if (!original) {
        throw new Error(`Work order ${id} not found`);
      }
      const newWoNumber = await this.generateWorkOrderNumber(orgId);
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
      if (options?.includeTasks !== false) {
        const originalTasks = await tx
          .select()
          .from(workOrderTasks)
          .where(eq(workOrderTasks.workOrderId, id));
        if (originalTasks.length > 0) {
          await tx
            .insert(workOrderTasks)
            .values(
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
          await tx
            .insert(workOrderParts)
            .values(
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
      await publishEvent("work_order.created", clonedOrder as unknown as Record<string, unknown>);
      return clonedOrder;
    });
  }

  async completeWorkOrder(
    workOrderId: string,
    completionData: InsertWorkOrderCompletion
  ): Promise<WorkOrderCompletion> {
    const { workOrderCompletions } = await import("@shared/schema-runtime");
    const now = new Date();
    // Task #81 — Capture inventoryMovement ids inside the transaction
    // so we can project them into the knowledge graph AFTER commit.
    // Same post-commit pattern used by dbInventoryStorage (avoids the
    // graph leading relational truth on rollback).
    const pendingProjections: PendingMovementProjection[] = [];
    const completion = await db.transaction(async (tx) => {
      const completionDataExt = completionData as InsertWorkOrderCompletion & {
        downtimeCostPerHour?: number | null;
        totalCost?: number | null;
      };
      const laborCost = completionDataExt.totalLaborCost || 0,
        partsCost = completionDataExt.totalPartsCost || 0,
        downtimeHours = completionDataExt.actualDowntimeHours || 0,
        downtimeCostPerHour = completionDataExt.downtimeCostPerHour || 1000;
      const downtimeCost = completionDataExt.totalCost ? 0 : downtimeHours * downtimeCostPerHour,
        totalCost = completionDataExt.totalCost || laborCost + partsCost + downtimeCost;
      const [updatedWorkOrder] = await tx
        .update(workOrders)
        .set({
          status: "completed",
          actualEndDate: now,
          totalLaborCost: laborCost,
          totalPartsCost: partsCost,
          totalCost,
          actualDowntimeHours: downtimeHours,
          downtimeCostPerHour,
        } as unknown as Partial<InsertWorkOrder>)
        .where(eq(workOrders.id, workOrderId))
        .returning();
      if (!updatedWorkOrder) {
        throw new Error(`Work order ${workOrderId} not found`);
      }
      const [completion] = await tx.insert(workOrderCompletions).values(completionData).returning();
      const woParts = await tx
        .select()
        .from(workOrderParts)
        .where(eq(workOrderParts.workOrderId, workOrderId));
      const consumeMap = new Map<string, number>();
      for (const woPart of woParts) {
        consumeMap.set(woPart.partId, (consumeMap.get(woPart.partId) || 0) + woPart.quantityUsed);
      }
      for (const [partId, totalConsume] of consumeMap.entries()) {
        const stockRows = await tx
          .select()
          .from(stock)
          .where(and(eq(stock.partId, partId), eq(stock.orgId, completionData.orgId)))
          .orderBy(sql`${stock.quantityReserved} DESC`);
        let remaining = totalConsume;
        for (const row of stockRows) {
          if (remaining <= 0) {
            break;
          }
          const onHand = row.quantityOnHand ?? 0;
          const reserved = row.quantityReserved ?? 0;
          const toConsume = Math.min(remaining, onHand);
          if (toConsume > 0) {
            const newOnHand = Math.max(0, onHand - toConsume);
            const newReserved = Math.max(0, reserved - toConsume);
            await tx
              .update(stock)
              .set({ quantityOnHand: newOnHand, quantityReserved: newReserved, updatedAt: now })
              .where(eq(stock.id, row.id));
            const movementId = randomUUID();
            await tx
              .insert(inventoryMovements)
              .values({
                id: movementId,
                orgId: completionData.orgId,
                partId,
                workOrderId,
                movementType: "consume",
                quantity: -toConsume,
                quantityBefore: onHand,
                quantityAfter: newOnHand,
                reservedBefore: reserved,
                reservedAfter: newReserved,
                performedBy: completionData.completedBy || "system",
                notes: `Consumed during work order completion: ${updatedWorkOrder.woNumber || workOrderId} (stock ${row.id})`,
              });
            pendingProjections.push({
              movementId,
              partId,
              workOrderId,
              movementType: "consume",
            });
            remaining -= toConsume;
          }
        }
      }
      return completion;
    });
    // Task #81 — fire graph projections post-commit. Best-effort by
    // contract; logged at warn level inside the helper if the graph
    // is unreachable. Awaiting here is fine — the helper is
    // short-circuit on empty input and on GRAPH_ENABLED=false.
    if (pendingProjections.length > 0 && completionData.orgId) {
      await fireInventoryMovementProjections(completionData.orgId, pendingProjections);
    }
    return completion;
  }

  async getWorkOrderCompletionAnalytics(filters?: {
    equipmentId?: string;
    vesselId?: string;
    startDate?: Date;
    endDate?: Date;
    orgId?: string;
  }): Promise<{
    totalCompletions: number;
    avgDurationVariance: number;
    avgCostVariance: number;
    onTimeCompletionRate: number;
    totalDowntimeHours: number;
  }> {
    const c = await dbWorkOrderStorage.getWorkOrderCompletions(filters);
    if (c.length === 0) {
      return {
        totalCompletions: 0,
        avgDurationVariance: 0,
        avgCostVariance: 0,
        onTimeCompletionRate: 0,
        totalDowntimeHours: 0,
      };
    }
    type CompletionExt = WorkOrderCompletion & {
      durationVariancePercent?: number | null;
      costVariancePercent?: number | null;
      onTimeCompletion?: boolean | null;
    };
    const cExt = c as unknown as CompletionExt[];
    const dv = cExt
        .filter((x) => x.durationVariancePercent != null)
        .map((x) => x.durationVariancePercent as number),
      cv = cExt
        .filter((x) => x.costVariancePercent != null)
        .map((x) => x.costVariancePercent as number),
      ot = cExt.filter((x) => x.onTimeCompletion === true).length,
      td = cExt.reduce((s, x) => s + (x.actualDowntimeHours || 0), 0);
    return {
      totalCompletions: c.length,
      avgDurationVariance: dv.length > 0 ? dv.reduce((a, b) => a + b, 0) / dv.length : 0,
      avgCostVariance: cv.length > 0 ? cv.reduce((a, b) => a + b, 0) / cv.length : 0,
      onTimeCompletionRate: c.length > 0 ? (ot / c.length) * 100 : 0,
      totalDowntimeHours: td,
    };
  }
}

export const workOrderService = new WorkOrderService();
