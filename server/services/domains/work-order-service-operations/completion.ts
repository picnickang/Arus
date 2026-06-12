import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type {
  InsertWorkOrder,
  InsertWorkOrderCompletion,
  WorkOrderCompletion,
} from "@shared/schema";
import { inventoryMovements, stock, workOrderParts, workOrders } from "@shared/schema-runtime";
import {
  fireInventoryMovementProjections,
  type PendingMovementProjection,
} from "../../../db/inventory/index.js";
import type { WorkOrderCompletionInput, WorkOrderCompletionResult, WorkOrderTx } from "./types";

type WorkOrderDb = typeof import("../../../db-config").db;

/**
 * Complete a work order on a caller-supplied transaction handle.
 *
 * Used by the application layer to fuse the completion write and the outbox
 * enqueue into a single atomic commit. The caller fires inventory movement
 * projections after the surrounding transaction commits.
 */
export async function completeWorkOrderInTx(
  tx: WorkOrderTx,
  workOrderId: string,
  completionData: InsertWorkOrderCompletion
): Promise<WorkOrderCompletionResult> {
  const { workOrderCompletions } = await import("@shared/schema-runtime");
  const now = new Date();
  const pendingProjections: PendingMovementProjection[] = [];
  const completion = await (async () => {
    const completionDataExt = completionData as WorkOrderCompletionInput;
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
      } satisfies Partial<InsertWorkOrder>)
      .where(eq(workOrders.id, workOrderId))
      .returning();
    if (!updatedWorkOrder) {
      throw new Error(`Work order ${workOrderId} not found`);
    }
    const [completion] = await tx.insert(workOrderCompletions).values(completionData).returning();
    if (!completion) {
      throw new Error("Failed to insert work order completion");
    }
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
          await tx.insert(inventoryMovements).values({
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
  })();
  return { completion, pendingProjections };
}

/**
 * Convenience wrapper that opens its own transaction. Preserved for legacy
 * callers that do not thread a transaction handle.
 */
export async function completeWorkOrder(
  db: WorkOrderDb,
  workOrderId: string,
  completionData: InsertWorkOrderCompletion
): Promise<WorkOrderCompletion> {
  const pendingProjections: PendingMovementProjection[] = [];
  const completion = await db.transaction(async (tx) => {
    const r = await completeWorkOrderInTx(tx, workOrderId, completionData);
    pendingProjections.push(...r.pendingProjections);
    return r.completion;
  });
  if (pendingProjections.length > 0 && completionData.orgId) {
    await fireInventoryMovementProjections(completionData.orgId, pendingProjections);
  }
  return completion;
}
