import type { Express, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireOrgId, requireOrgIdAndValidateBody } from "../middleware/auth";
import { requireRole } from "../middleware/role-auth";
import { withErrorHandling, sendCreated, sendNotFound } from "../lib/route-utils";
import { logger } from "../utils/logger";
import { domainEventBus, createDomainEvent } from "../lib/domain-event-bus";

const PROCUREMENT_ROLES = ["chief_engineer", "second_engineer", "captain", "chief_officer", "admin"] as const;

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
          sr.created_at AS "createdAt",
          sr.updated_at AS "updatedAt"
        FROM service_requests sr
        LEFT JOIN work_orders wo ON wo.id = sr.work_order_id AND wo.org_id = ${orgId}
        WHERE sr.org_id = ${orgId}
      `;

      if (status) {
        query = sql`${query} AND sr.status = ${status}`;
      }
      if (workOrderId) {
        query = sql`${query} AND sr.work_order_id = ${workOrderId}`;
      }

      query = sql`${query} ORDER BY sr.created_at DESC`;

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
          wo.description AS "workOrderDescription"
        FROM service_requests sr
        LEFT JOIN work_orders wo ON wo.id = sr.work_order_id AND wo.org_id = ${orgId}
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

      const { title, description, urgency, estimatedCost } = req.body;
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
    requireRole(...PROCUREMENT_ROLES),
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
    requireRole(...PROCUREMENT_ROLES),
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
    requireRole(...PROCUREMENT_ROLES),
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
    requireRole(...PROCUREMENT_ROLES),
    writeOperationRateLimit,
    withErrorHandling("convert service request to service order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);

      const [sr] = await db.execute(sql`
        SELECT sr.id, sr.status, sr.work_order_id, sr.title, sr.description,
               sr.estimated_cost, sr.request_number,
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

      const [supplierCheck] = await db.execute(sql`
        SELECT id FROM suppliers WHERE id = ${serviceProviderId} AND org_id = ${orgId}
      `).then((r) => r.rows || r);
      if (!supplierCheck) {
        return res.status(400).json({ error: "Service provider not found in this organization" });
      }

      const [seqResult] = await db.execute(sql`
        SELECT COALESCE(
          MAX(CAST(SUBSTRING(so_number FROM 'SO-([0-9]+)') AS INTEGER)),
          0
        ) + 1 AS next_num
        FROM service_orders
        WHERE org_id = ${orgId}
      `).then((r) => r.rows || r);
      const soNumber = `SO-${String(seqResult?.next_num || 1).padStart(4, "0")}`;

      const [newSo] = await db.execute(sql`
        INSERT INTO service_orders (
          id, org_id, so_number, status,
          work_order_id, work_order_number,
          service_provider_id,
          scope, quoted_amount,
          scheduled_start_date, scheduled_end_date,
          created_at, updated_at
        )
        VALUES (
          gen_random_uuid()::text,
          ${orgId},
          ${soNumber},
          'draft',
          ${sr.work_order_id},
          ${sr.wo_number},
          ${serviceProviderId},
          ${scope || sr.description || sr.wo_description || null},
          ${estimatedCost ? Number(estimatedCost) : sr.estimated_cost ? Number(sr.estimated_cost) : null},
          ${scheduledStartDate || null},
          ${scheduledEndDate || null},
          NOW(),
          NOW()
        )
        RETURNING *
      `).then((r) => r.rows || r);

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

      await db.execute(sql`
        UPDATE work_orders
        SET
          status = 'awaiting_service',
          updated_at = NOW()
        WHERE id = ${sr.work_order_id} AND org_id = ${orgId}
      `);

      domainEventBus.emit(
        "service_request.converted",
        createDomainEvent("service_request.converted", orgId, {
          serviceRequestId: sr.id,
          requestNumber: sr.request_number,
          workOrderId: sr.work_order_id,
          serviceOrderId: newSo.id,
          soNumber,
          convertedBy: userId,
        }, { userId, aggregateId: sr.id, aggregateType: "ServiceRequest" })
      );

      logger.info(`Service request ${req.params.id} converted to SO ${soNumber} by ${userId}`);
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
