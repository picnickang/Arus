/**
 * Sync Jobs - Purchase Order Dependencies Check
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("SyncJobs:PurchaseOrders");
import { db } from "../db.js";
import { parts, reservations, purchaseOrders, purchaseOrderItems } from "@shared/schema.js";
import { eq, sql, and } from "drizzle-orm";
import type { SyncJobCheckResult } from "./types.js";

/**
 * Check for work orders waiting on open purchase orders
 */
export async function checkWorkOrdersPendingOnPO(orgId: string): Promise<SyncJobCheckResult> {
  const issues: SyncJobCheckResult["issues"] = [];

  try {
    const pendingWorkOrders = await db
      .select({
        workOrderId: reservations.workOrderId,
        partId: reservations.partId,
        partName: parts.name,
        reservedQty: reservations.quantity,
        poId: purchaseOrders.id,
        orderNumber: purchaseOrders.orderNumber,
        expectedDate: purchaseOrders.expectedDate,
        poStatus: purchaseOrders.status,
      })
      .from(reservations)
      .innerJoin(parts, eq(reservations.partId, parts.id))
      .innerJoin(purchaseOrderItems, eq(purchaseOrderItems.partId, reservations.partId))
      .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderItems.poId))
      .where(
        and(
          eq(parts.orgId, orgId),
          eq(reservations.orgId, orgId),
          eq(purchaseOrders.orgId, orgId),
          eq(reservations.status, "active"),
          sql`${purchaseOrders.status} IN ('draft', 'sent', 'acknowledged', 'shipped')`
        )
      );

    for (const pending of pendingWorkOrders) {
      const severity =
        pending.expectedDate && new Date(pending.expectedDate) < new Date() ? "high" : "medium";
      const expectedText = pending.expectedDate
        ? ` (expected ${pending.expectedDate.toLocaleDateString()})`
        : " (no expected date)";

      issues.push({
        code: "WORK_ORDER_WAITING_ON_PO",
        message: `Work Order ${pending.workOrderId} waiting for part ${pending.partName} from PO ${pending.orderNumber}${expectedText}`,
        severity,
        reference: {
          workOrderId: pending.workOrderId,
          partId: pending.partId,
          poId: pending.poId,
          orderNumber: pending.orderNumber,
          expectedDate: pending.expectedDate,
          status: pending.poStatus,
        },
      });
    }

    return { issues, entitiesChecked: pendingWorkOrders.length };
  } catch (error) {
    logger.error("Work orders pending on PO check failed:", undefined, error);
    return {
      issues: [
        {
          code: "PO_DEPENDENCY_CHECK_ERROR",
          message: `Failed to check work order PO dependencies: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "high",
        },
      ],
      entitiesChecked: 0,
    };
  }
}
