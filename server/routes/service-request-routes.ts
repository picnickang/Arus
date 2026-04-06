import type { Express, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireOrgId, requireOrgIdAndValidateBody } from "../middleware/auth";
import { checkPermissionInDev } from "../domains/permissions/middleware";
import { withErrorHandling, sendCreated, sendNotFound } from "../lib/route-utils";
import { logger } from "../utils/logger";
import { domainEventBus, createDomainEvent } from "../lib/domain-event-bus";
import { createServiceOrderFromWorkOrder } from "./wo-so-bridge-routes";

function getOrgId(req: Request): string {
  const orgId = (req as any).orgId || req.headers["x-org-id"];
  if (!orgId) throw new Error("Missing orgId");
  return orgId as string;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || req.headers["x-user-id"] as string || "system";
}

export function registerServiceRequestRoutes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, generalApiRateLimit } = rateLimiters;

  app.get(
    "/api/service-requests",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("list service requests", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const status = req.query.status as string | undefined;
      const workOrderId = req.query.workOrderId as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;

      let query = sql`
        SELECT
          sr.id,
          sr.request_number AS "requestNumber",
          sr.title,
          sr.description,
          sr.urgency,
          sr.estimated_cost AS "estimatedCost",
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
          sr.created_at AS "createdAt",
          sr.updated_at AS "updatedAt"
        FROM service_requests sr
        LEFT JOIN work_orders wo ON wo.id = sr.work_order_id AND wo.org_id = ${orgId}
        LEFT JOIN equipment e ON e.id = wo.equipment_id
        LEFT JOIN vessels v ON v.id = wo.vessel_id
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
    generalApiRateLimit,
    withErrorHandling("get service request", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const [row] = await db.execute(sql`
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
        WHERE sr.id = ${req.params.id} AND sr.org_id = ${orgId}
      `).then((r) => r.rows || r);

      if (!row) return sendNotFound(res, "Service Request");
      res.json(row);
    })
  );

  app.post(
    "/api/work-orders/:id/service-requests",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create service request from work order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const workOrderId = req.params.id;
      const userId = getUserId(req);

      const [wo] = await db.execute(sql`
        SELECT id, wo_number, description, vessel_id, status
        FROM work_orders
        WHERE id = ${workOrderId} AND org_id = ${orgId}
      `).then((r) => r.rows || r);

      if (!wo) return sendNotFound(res, "Work Order");

      const { title, description, urgency, estimatedCost, serviceDetails, specialRequirements } = req.body;
      if (!title) return res.status(400).json({ error: "title is required" });

      const previousWoStatus = wo.status;

      const [seqResult] = await db.execute(sql`
        SELECT COALESCE(
          MAX(CAST(SUBSTRING(request_number FROM 'SR-([0-9]+)') AS INTEGER)),
          0
        ) + 1 AS next_num
        FROM service_requests
        WHERE org_id = ${orgId}
      `).then((r) => r.rows || r);
      const requestNumber = `SR-${String(seqResult?.next_num || 1).padStart(4, "0")}`;

      const [newSr] = await db.execute(sql`
        INSERT INTO service_requests (
          id, org_id, work_order_id, request_number,
          title, description, urgency, estimated_cost,
          service_details, special_requirements,
          requested_by, status, previous_wo_status,
          created_at, updated_at
        )
        VALUES (
          gen_random_uuid()::text,
          ${orgId},
          ${workOrderId},
          ${requestNumber},
          ${title},
          ${description || null},
          ${urgency || "medium"},
          ${estimatedCost ? Number(estimatedCost) : null},
          ${serviceDetails || null},
          ${specialRequirements || null},
          ${userId},
          'pending_review',
          ${previousWoStatus},
          NOW(),
          NOW()
        )
        RETURNING *
      `).then((r) => r.rows || r);

      await db.execute(sql`
        UPDATE work_orders
        SET status = 'awaiting_service', updated_at = NOW()
        WHERE id = ${workOrderId} AND org_id = ${orgId}
          AND status NOT IN ('completed', 'cancelled', 'awaiting_service')
      `);

      domainEventBus.emit(
        "service_request.created",
        createDomainEvent("service_request.created", orgId, {
          serviceRequestId: newSr.id,
          requestNumber,
          workOrderId,
          title,
          urgency: urgency || "medium",
          requestedBy: userId,
        }, { userId, aggregateId: newSr.id, aggregateType: "ServiceRequest" })
      );

      logger.info(`Created service request ${requestNumber} from work order ${workOrderId}, WO status changed to awaiting_service (was: ${previousWoStatus})`);
      sendCreated(res, newSr);
    })
  );

  app.post(
    "/api/service-requests/:id/review",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_requests", "edit"),
    writeOperationRateLimit,
    withErrorHandling("review service request", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);

      const [sr] = await db.execute(sql`
        SELECT id, status, work_order_id, request_number FROM service_requests
        WHERE id = ${req.params.id} AND org_id = ${orgId}
      `).then((r) => r.rows || r);

      if (!sr) return sendNotFound(res, "Service Request");

      if (sr.status !== "pending_review") {
        return res.status(400).json({ error: `Cannot review a request in '${sr.status}' status` });
      }

      const [updated] = await db.execute(sql`
        UPDATE service_requests
        SET status = 'under_review', reviewed_by = ${userId}, updated_at = NOW()
        WHERE id = ${req.params.id} AND org_id = ${orgId}
        RETURNING *
      `).then((r) => r.rows || r);

      res.json(updated);
    })
  );

  app.post(
    "/api/service-requests/:id/approve",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_requests", "approve"),
    writeOperationRateLimit,
    withErrorHandling("approve service request", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);

      const [sr] = await db.execute(sql`
        SELECT id, status, work_order_id, title, description, estimated_cost, request_number
        FROM service_requests
        WHERE id = ${req.params.id} AND org_id = ${orgId}
      `).then((r) => r.rows || r);

      if (!sr) return sendNotFound(res, "Service Request");

      if (sr.status !== "pending_review" && sr.status !== "under_review") {
        return res.status(400).json({ error: `Cannot approve a request in '${sr.status}' status` });
      }

      const [updated] = await db.execute(sql`
        UPDATE service_requests
        SET status = 'approved', reviewed_by = ${userId}, reviewed_at = NOW(), updated_at = NOW()
        WHERE id = ${req.params.id} AND org_id = ${orgId}
        RETURNING *
      `).then((r) => r.rows || r);

      domainEventBus.emit(
        "service_request.approved",
        createDomainEvent("service_request.approved", orgId, {
          serviceRequestId: sr.id,
          requestNumber: sr.request_number,
          workOrderId: sr.work_order_id,
          approvedBy: userId,
        }, { userId, aggregateId: sr.id, aggregateType: "ServiceRequest" })
      );

      res.json(updated);
    })
  );

  app.post(
    "/api/service-requests/:id/reject",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_requests", "approve"),
    writeOperationRateLimit,
    withErrorHandling("reject service request", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);

      const [sr] = await db.execute(sql`
        SELECT id, status, work_order_id, request_number, previous_wo_status
        FROM service_requests
        WHERE id = ${req.params.id} AND org_id = ${orgId}
      `).then((r) => r.rows || r);

      if (!sr) return sendNotFound(res, "Service Request");

      if (sr.status !== "pending_review" && sr.status !== "under_review") {
        return res.status(400).json({ error: `Cannot reject a request in '${sr.status}' status` });
      }

      const { reason } = req.body;

      const [updated] = await db.execute(sql`
        UPDATE service_requests
        SET
          status = 'rejected',
          rejection_reason = ${reason || null},
          reviewed_by = ${userId},
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${req.params.id} AND org_id = ${orgId}
        RETURNING *
      `).then((r) => r.rows || r);

      const restoreStatus = sr.previous_wo_status || "open";
      await db.execute(sql`
        UPDATE work_orders
        SET
          status = ${restoreStatus},
          updated_at = NOW()
        WHERE id = ${sr.work_order_id} AND org_id = ${orgId}
          AND status = 'awaiting_service'
      `);

      domainEventBus.emit(
        "service_request.rejected",
        createDomainEvent("service_request.rejected", orgId, {
          serviceRequestId: sr.id,
          requestNumber: sr.request_number,
          workOrderId: sr.work_order_id,
          rejectedBy: userId,
          reason: reason || undefined,
        }, { userId, aggregateId: sr.id, aggregateType: "ServiceRequest" })
      );

      logger.info(`Service request ${req.params.id} rejected by ${userId}, WO status restored to '${restoreStatus}'`);
      res.json(updated);
    })
  );

  app.post(
    "/api/service-requests/:id/convert",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_requests", "approve"),
    writeOperationRateLimit,
    withErrorHandling("convert service request to service order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);

      const [sr] = await db.execute(sql`
        SELECT sr.id, sr.status, sr.work_order_id, sr.title, sr.description,
               sr.estimated_cost, sr.request_number, sr.service_details, sr.special_requirements,
               wo.wo_number, wo.description AS wo_description,
               wo.equipment_id, wo.vessel_id
        FROM service_requests sr
        JOIN work_orders wo ON wo.id = sr.work_order_id AND wo.org_id = ${orgId}
        WHERE sr.id = ${req.params.id} AND sr.org_id = ${orgId}
      `).then((r) => r.rows || r);

      if (!sr) return sendNotFound(res, "Service Request");

      if (sr.status !== "approved") {
        return res.status(400).json({ error: `Can only convert approved requests. Current status: '${sr.status}'` });
      }

      const { serviceProviderId, scope, estimatedCost, scheduledStartDate, scheduledEndDate } = req.body;

      if (!serviceProviderId) {
        return res.status(400).json({ error: "serviceProviderId is required for conversion" });
      }

      const newSo = await createServiceOrderFromWorkOrder(db, {
        orgId,
        workOrderId: sr.work_order_id,
        woNumber: sr.wo_number,
        woDescription: sr.wo_description,
        serviceProviderId,
        scope: scope || sr.description || sr.wo_description || null,
        estimatedCost: estimatedCost ? Number(estimatedCost) : sr.estimated_cost ? Number(sr.estimated_cost) : null,
        scheduledStartDate: scheduledStartDate || null,
        scheduledEndDate: scheduledEndDate || null,
        serviceDetails: sr.service_details || null,
        specialRequirements: sr.special_requirements || null,
        updateWorkOrderStatus: true,
      });

      await db.execute(sql`
        UPDATE service_requests
        SET
          status = 'converted',
          service_order_id = ${newSo.id},
          converted_at = NOW(),
          reviewed_by = ${userId},
          reviewed_at = COALESCE(reviewed_at, NOW()),
          updated_at = NOW()
        WHERE id = ${req.params.id} AND org_id = ${orgId}
      `);

      domainEventBus.emit(
        "service_request.converted",
        createDomainEvent("service_request.converted", orgId, {
          serviceRequestId: sr.id,
          requestNumber: sr.request_number,
          workOrderId: sr.work_order_id,
          serviceOrderId: newSo.id,
          soNumber: newSo.so_number,
          convertedBy: userId,
        }, { userId, aggregateId: sr.id, aggregateType: "ServiceRequest" })
      );

      logger.info(`Service request ${req.params.id} converted to SO ${newSo.so_number} by ${userId}`);
      res.json({ serviceRequest: { id: req.params.id, status: "converted", serviceOrderId: newSo.id }, serviceOrder: newSo });
    })
  );

  app.get(
    "/api/work-orders/:id/service-requests",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("get service requests for work order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const workOrderId = req.params.id;

      const rows = await db.execute(sql`
        SELECT
          sr.id,
          sr.request_number AS "requestNumber",
          sr.title,
          sr.description,
          sr.urgency,
          sr.estimated_cost AS "estimatedCost",
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
    })
  );
}
