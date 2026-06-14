import type { Express, Request, Response } from "express";
import { checkPermissionInDev } from "../domains/permissions/middleware";
import { requireOrgId } from "../middleware/auth";
import { sendNotFound, withErrorHandling } from "../lib/route-utils";
import {
  getServiceRequestWithDetails,
  listServiceRequestsForOrg,
  listServiceRequestsForWorkOrder,
} from "../service-orders/repository";
import { getOrgId, type ServiceRequestRouteRateLimiters } from "./service-request-route-utils";

export function registerServiceRequestReadRoutes(
  app: Express,
  { generalApiRateLimit }: Pick<ServiceRequestRouteRateLimiters, "generalApiRateLimit">
) {
  app.get(
    "/api/service-requests",
    requireOrgId,
    checkPermissionInDev("service_requests", "view"),
    generalApiRateLimit,
    withErrorHandling("list service requests", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const status = req.query["status"] as string | undefined;
      const workOrderId = req.query["workOrderId"] as string | undefined;
      const sortBy = req.query["sortBy"] as string | undefined;

      const rows = await listServiceRequestsForOrg(orgId, { status, workOrderId, sortBy });
      res.json(rows);
    })
  );

  app.get(
    "/api/service-requests/:id",
    requireOrgId,
    checkPermissionInDev("service_requests", "view"),
    generalApiRateLimit,
    withErrorHandling("get service request", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const row = await getServiceRequestWithDetails(req.params["id"] ?? "", orgId);

      if (!row) {
        return sendNotFound(res, "Service Request");
      }
      res.json(row);
    })
  );

  app.get(
    "/api/work-orders/:id/service-requests",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling(
      "get service requests for work order",
      async (req: Request, res: Response) => {
        const orgId = getOrgId(req);
        const workOrderId = req.params["id"] ?? "";

        const rows = await listServiceRequestsForWorkOrder(workOrderId, orgId);

        res.json({
          workOrderId,
          serviceRequests: rows,
          count: rows.length,
        });
      }
    )
  );
}
