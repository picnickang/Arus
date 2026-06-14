import { and, eq, sql } from "drizzle-orm";
import type { InsertWorkOrder, WorkOrder } from "@shared/schema";
import {
  equipment,
  maintenanceCosts,
  stock,
  vessels,
  workOrderChecklists,
  workOrderParts,
  workOrderWorklogs,
  workOrders,
} from "@shared/schema-runtime";
import { dbInventoryStorage } from "../../../db/inventory/index.js";
import type { WidenPartial } from "../../../lib/widen-partial";
import { getWebSocketServer } from "../../../websocket-server";
import type { WorkOrderCloseData, WorkOrderDb } from "./types";

export async function updateWorkOrderWithDowntimeTracking(
  db: WorkOrderDb,
  id: string,
  updates: WidenPartial<InsertWorkOrder>
): Promise<WorkOrder> {
  const updatedOrder = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (!existing) {
      throw new Error(`Work order ${id} not found`);
    }

    const postUpdateOrder = { ...existing, ...updates };
    const finalUpdates: WidenPartial<InsertWorkOrder> & {
      vesselDowntimeStartedAt?: Date | null | undefined;
    } = {
      ...updates,
    };
    const equipmentIdForDowntime = postUpdateOrder.equipmentId;
    const shouldTrackDowntime = postUpdateOrder.affectsVesselDowntime && equipmentIdForDowntime;

    if (shouldTrackDowntime && equipmentIdForDowntime) {
      const [equipmentResult] = await tx
        .select()
        .from(equipment)
        .where(eq(equipment.id, equipmentIdForDowntime))
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

          const [vessel] = await tx.select().from(vessels).where(eq(vessels.id, vesselId)).limit(1);
          if (vessel) {
            const currentDowntime = vessel.downtimeDays ?? 0;
            await tx
              .update(vessels)
              .set({
                downtimeDays: Number((currentDowntime + downtimeDays).toFixed(2)),
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, vesselId));
          }
          finalUpdates.vesselDowntimeStartedAt = null;
        }
      }
    }

    const finalUpdatesStripped = Object.fromEntries(
      Object.entries(finalUpdates).filter(([, v]) => v !== undefined)
    ) as Partial<InsertWorkOrder> & { vesselDowntimeStartedAt?: Date | null };
    const [result] = await tx
      .update(workOrders)
      .set(finalUpdatesStripped)
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

export async function closeWorkOrderWithInventoryRelease(
  db: WorkOrderDb,
  id: string,
  closeData: WorkOrderCloseData
): Promise<WorkOrder> {
  const closedOrder = await db.transaction(async (tx) => {
    const parts = await tx.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, id));
    await tx
      .select()
      .from(stock)
      .where(sql`${stock.partId} IN (SELECT part_id FROM work_order_parts WHERE work_order_id = ${id})`)
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

export async function closeWorkOrder(
  db: WorkOrderDb,
  id: string,
  closeData: WorkOrderCloseData
): Promise<WorkOrder> {
  const closedOrder = await db.transaction(async (tx) => {
    const txParts = await tx.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, id));
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
      const firstEq = eqRes[0];
      if (firstEq && firstEq.vesselId) {
        const vesselId = firstEq.vesselId;
        const startTime = new Date(workOrder.vesselDowntimeStartedAt);
        const downtimeDays = (new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);
        const vessel = await tx.select().from(vessels).where(eq(vessels.id, vesselId)).limit(1);
        const firstVessel = vessel[0];
        if (firstVessel) {
          const cd = firstVessel.downtimeDays ?? 0;
          await tx
            .update(vessels)
            .set({ downtimeDays: Number((cd + downtimeDays).toFixed(2)), updatedAt: new Date() })
            .where(eq(vessels.id, vesselId));
        }
        finalUpdates.vesselDowntimeStartedAt = null;
      }
    }
    if (closeData.notes || closeData.completedBy) {
      await tx.insert(workOrderWorklogs).values({
        workOrderId: id,
        orgId: workOrder.orgId,
        performedBy: closeData.completedBy || "system",
        laborHours: 0,
        laborCost: 0,
        notes: closeData.notes || "Work order completed",
        performedAt: new Date(),
      } as never);
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

export async function deleteWorkOrderCascade(db: WorkOrderDb, id: string): Promise<void> {
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
