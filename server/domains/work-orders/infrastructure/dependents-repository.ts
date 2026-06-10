/**
 * Infrastructure: work-order dependents counting.
 *
 * Holds the raw `db` access for the "dependents" interface route so the
 * interface layer (interfaces/dependents.ts) depends on this repository
 * rather than importing the database handle directly (hexagonal storage
 * boundary). Query logic is unchanged — moved verbatim from the route.
 */
import { sql, type AnyColumn, type SQLWrapper } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "../../../db";
import {
  workOrders,
  workOrderParts,
  workOrderChecklists,
  workOrderWorklogs,
  purchaseRequests,
  serviceRequests,
  serviceOrders,
} from "@shared/schema-runtime";

type CountRow = { count: number };

async function countWhere(
  table: PgTable,
  workOrderIdCol: AnyColumn | SQLWrapper,
  workOrderId: string
): Promise<number> {
  const [row] = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(sql`${workOrderIdCol} = ${workOrderId}`)) as CountRow[];
  return row?.count ?? 0;
}

/** Resolve a work order's id + orgId (for the tenant ownership check). */
export async function findWorkOrderForDependents(
  workOrderId: string
): Promise<{ id: string; orgId: string | null } | undefined> {
  const [wo] = await db
    .select({ id: workOrders.id, orgId: workOrders.orgId })
    .from(workOrders)
    .where(sql`${workOrders.id} = ${workOrderId}`)
    .limit(1);
  return wo;
}

export interface WorkOrderDependents {
  cascade: { parts: number; checklists: number; worklogs: number };
  linked: {
    purchaseRequests: number;
    serviceRequests: number;
    serviceOrders: number;
  };
  totals: { cascade: number; linked: number };
}

/** Count the cascade + linked dependents of a work order. */
export async function countWorkOrderDependents(workOrderId: string): Promise<WorkOrderDependents> {
  const [
    partsCount,
    checklistsCount,
    worklogsCount,
    purchaseRequestsCount,
    serviceRequestsCount,
    serviceOrdersCount,
  ] = await Promise.all([
    countWhere(workOrderParts, workOrderParts.workOrderId, workOrderId),
    countWhere(workOrderChecklists, workOrderChecklists.workOrderId, workOrderId),
    countWhere(workOrderWorklogs, workOrderWorklogs.workOrderId, workOrderId),
    countWhere(purchaseRequests, purchaseRequests.workOrderId, workOrderId),
    countWhere(serviceRequests, serviceRequests.workOrderId, workOrderId),
    countWhere(serviceOrders, serviceOrders.workOrderId, workOrderId),
  ]);

  const cascade = {
    parts: partsCount,
    checklists: checklistsCount,
    worklogs: worklogsCount,
  };
  const linked = {
    purchaseRequests: purchaseRequestsCount,
    serviceRequests: serviceRequestsCount,
    serviceOrders: serviceOrdersCount,
  };
  return {
    cascade,
    linked,
    totals: {
      cascade: cascade.parts + cascade.checklists + cascade.worklogs,
      linked: linked.purchaseRequests + linked.serviceRequests + linked.serviceOrders,
    },
  };
}
