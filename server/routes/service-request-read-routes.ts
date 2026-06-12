import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { checkPermissionInDev } from "../domains/permissions/middleware";
import { requireOrgId } from "../middleware/auth";
import { sendNotFound, withErrorHandling } from "../lib/route-utils";
import {
  getOrgId,
  type ServiceRequestRouteRateLimiters,
  type ServiceRequestRow,
  unwrapRows,
} from "./service-request-route-utils";

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

      let query = sql`
        SELECT
          sr.id,
          sr.request_number AS "requestNumber",
          sr.title,
          sr.description,
          sr.urgency,
          sr.estimated_cost::float8 AS "estimatedCost",
          sr.requested_by AS "requestedBy",
          sr.status,
          sr.rejection_reason AS "rejectionReason",
          sr.reviewed_by AS "reviewedBy",
          sr.reviewed_at AS "reviewedAt",
          sr.converted_at AS "convertedAt",
          sr.work_order_id AS "workOrderId",
          sr.service_order_id AS "serviceOrderId",
          sr.previous_wo_status AS "previousWoStatus",
          wo.wo_number AS "workOrderNumber",
          wo.description AS "workOrderDescription",
          e.name AS "equipmentName",
          v.name AS "vesselName",
          so.so_number AS "serviceOrderNumber",
          so.status AS "serviceOrderStatus",
          sr.created_at AS "createdAt",
          sr.updated_at AS "updatedAt"
        FROM service_requests sr
        LEFT JOIN work_orders wo ON wo.id = sr.work_order_id AND wo.org_id = ${orgId}
        LEFT JOIN equipment e ON e.id = wo.equipment_id
        LEFT JOIN vessels v ON v.id = wo.vessel_id
        LEFT JOIN service_orders so ON so.id = sr.service_order_id AND so.org_id = ${orgId}
        WHERE sr.org_id = ${orgId}
      `;

      if (status === "actionable") {
        query = sql`${query} AND sr.status IN ('pending_review', 'under_review', 'approved')`;
      } else if (status) {
        query = sql`${query} AND sr.status = ${status}`;
      }
      if (workOrderId) {
        query = sql`${query} AND sr.work_order_id = ${workOrderId}`;
      }

      if (sortBy === "vessel") {
        query = sql`${query} ORDER BY v.name ASC NULLS LAST, sr.created_at DESC`;
      } else if (sortBy === "urgency") {
        query = sql`${query} ORDER BY
          CASE sr.urgency
            WHEN 'critical' THEN 0
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            ELSE 4
          END ASC,
          sr.created_at DESC`;
      } else {
        query = sql`${query} ORDER BY sr.created_at DESC`;
      }

      const rows = await db.execute(query);
      res.json(rows.rows || rows);
    })
  );

  app.get(
    "/api/service-requests/:id",
    requireOrgId,
    checkPermissionInDev("service_requests", "view"),
    generalApiRateLimit,
    withErrorHandling("get service request", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const [row] = await db
        .execute(
          sql`
        SELECT
          sr.*,
          wo.wo_number AS "workOrderNumber",
          wo.description AS "workOrderDescription",
          e.name AS "equipmentName",
          v.name AS "vesselName"
        FROM service_requests sr
        LEFT JOIN work_orders wo ON wo.id = sr.work_order_id AND wo.org_id = ${orgId}
        LEFT JOIN equipment e ON e.id = wo.equipment_id
        LEFT JOIN vessels v ON v.id = wo.vessel_id
        WHERE sr.id = ${req.params["id"]} AND sr.org_id = ${orgId}
      `
        )
        .then(unwrapRows<ServiceRequestRow>);

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
        const workOrderId = req.params["id"];

        const rows = await db.execute(sql`
        SELECT
          sr.id,
          sr.request_number AS "requestNumber",
          sr.title,
          sr.description,
          sr.urgency,
          sr.estimated_cost::float8 AS "estimatedCost",
          sr.requested_by AS "requestedBy",
          sr.status,
          sr.rejection_reason AS "rejectionReason",
          sr.service_order_id AS "serviceOrderId",
          sr.reviewed_by AS "reviewedBy",
          sr.reviewed_at AS "reviewedAt",
          sr.converted_at AS "convertedAt",
          sr.previous_wo_status AS "previousWoStatus",
          sr.created_at AS "createdAt",
          sr.updated_at AS "updatedAt"
        FROM service_requests sr
        WHERE sr.work_order_id = ${workOrderId}
          AND sr.org_id = ${orgId}
        ORDER BY sr.created_at DESC
      `);

        res.json({
          workOrderId,
          serviceRequests: rows.rows || rows,
          count: (rows.rows || rows).length,
        });
      }
    )
  );
}
