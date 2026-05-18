import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  workOrders,
  workOrderParts,
  workOrderChecklists,
  workOrderWorklogs,
} from "@shared/schema";
import { purchaseRequests, serviceRequests, serviceOrders } from "@shared/schema/purchasing";
import { requireOrgId, AuthenticatedRequest } from "../../../middleware/auth";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils";

type CountRow = { count: number };
async function countWhere(
  table: any,
  workOrderIdCol: any,
  workOrderId: string,
): Promise<number> {
  const [row] = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(sql`${workOrderIdCol} = ${workOrderId}`)) as CountRow[];
  return row?.count ?? 0;
}

export function registerDependentsRoutes(app: Express) {
  app.get(
    "/api/work-orders/:id/dependents",
    requireOrgId,
    withErrorHandling(
      "fetch work order dependents",
      async (req: Request, res: Response) => {
        const orgId = (req as AuthenticatedRequest).orgId;
        const id = req.params.id;

        const [wo] = await db
          .select({ id: workOrders.id, orgId: workOrders.orgId })
          .from(workOrders)
          .where(sql`${workOrders.id} = ${id}`)
          .limit(1);

        if (!wo || (orgId && wo.orgId !== orgId)) {
          sendNotFound(res, "Work order");
          return;
        }

        const [
          partsCount,
          checklistsCount,
          worklogsCount,
          purchaseRequestsCount,
          serviceRequestsCount,
          serviceOrdersCount,
        ] = await Promise.all([
          countWhere(workOrderParts, workOrderParts.workOrderId, id),
          countWhere(workOrderChecklists, workOrderChecklists.workOrderId, id),
          countWhere(workOrderWorklogs, workOrderWorklogs.workOrderId, id),
          countWhere(purchaseRequests, purchaseRequests.workOrderId, id),
          countWhere(serviceRequests, serviceRequests.workOrderId, id),
          countWhere(serviceOrders, serviceOrders.workOrderId, id),
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
        const totals = {
          cascade:
            cascade.parts + cascade.checklists + cascade.worklogs,
          linked:
            linked.purchaseRequests +
            linked.serviceRequests +
            linked.serviceOrders,
        };

        res.json({ workOrderId: id, cascade, linked, totals });
      },
    ),
  );
}
