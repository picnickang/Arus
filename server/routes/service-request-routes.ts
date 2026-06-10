import { randomUUID } from "node:crypto";
import type { Express, Request, RequestHandler, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  authenticatedRequest,
  requireOrgId,
  requireOrgIdAndValidateBody,
} from "../middleware/auth";
import { checkPermissionInDev } from "../domains/permissions/middleware";
import { withErrorHandling, sendCreated, sendNotFound } from "../lib/route-utils";
import { logger } from "../utils/logger";
import { domainEventBus, createDomainEvent } from "../lib/domain-event-bus";
import { createServiceOrderFromWorkOrder } from "./wo-so-bridge-routes";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

function getOrgId(req: Request): string {
  const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
  if (!orgId) {
    throw new Error("Missing orgId");
  }
  return orgId as string;
}

function getUserId(req: Request): string {
  return authenticatedRequest(req).user?.id || (req.headers["x-user-id"] as string) || "system";
}

interface ServiceRequestRow {
  id: string;
  request_number: string;
  title: string;
  description: string | null;
  urgency: string | null;
  estimated_cost: number | string | null;
  requested_by: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  converted_at: string | null;
  work_order_id: string;
  service_order_id: string | null;
  previous_wo_status: string | null;
  service_details: string | null;
  special_requirements: string | null;
  wo_number?: string;
  wo_description?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface WorkOrderRow {
  id: string;
  wo_number: string;
  status: string;
  description: string | null;
  equipment_id: string | null;
  vessel_id: string | null;
  org_id: string;
}

function unwrapRows<T = Record<string, unknown>>(r: unknown): T[] {
  if (Array.isArray(r)) {
    return r as T[];
  }
  if (r && typeof r === "object" && "rows" in r) {
    return (r as { rows: T[] }).rows ?? [];
  }
  return [];
}

export function registerServiceRequestRoutes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: RequestHandler;
    generalApiRateLimit: RequestHandler;
  }
) {
  const { writeOperationRateLimit, generalApiRateLimit } = rateLimiters;

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

  app.patch(
    "/api/service-requests/:id",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_requests", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update service request", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);

      const [sr] = await db
        .execute(
          sql`
        SELECT id, status FROM service_requests
        WHERE id = ${req.params["id"]} AND org_id = ${orgId}
      `
        )
        .then(unwrapRows<ServiceRequestRow>);

      if (!sr) {
        return sendNotFound(res, "Service Request");
      }

      if (sr.status === "converted" || sr.status === "rejected") {
        return res.status(400).json({ error: `Cannot edit a request in '${sr.status}' status` });
      }

      const { title, description, urgency, estimatedCost, serviceDetails, specialRequirements } =
        req.body;

      const updates: Record<string, string | number | null> = {};
      if (title !== undefined) {
        updates["title"] = title;
      }
      if (description !== undefined) {
        updates["description"] = description || null;
      }
      if (urgency !== undefined) {
        updates["urgency"] = urgency;
      }
      if (estimatedCost !== undefined) {
        updates["estimated_cost"] = estimatedCost ? Number(estimatedCost) : null;
      }
      if (serviceDetails !== undefined) {
        updates["service_details"] = serviceDetails || null;
      }
      if (specialRequirements !== undefined) {
        updates["special_requirements"] = specialRequirements || null;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const [updated] = await db
        .execute(
          sql`
        UPDATE service_requests
        SET
          title = ${updates["title"] !== undefined ? updates["title"] : sql`title`},
          description = ${updates["description"] !== undefined ? updates["description"] : sql`description`},
          urgency = ${updates["urgency"] !== undefined ? updates["urgency"] : sql`urgency`},
          estimated_cost = ${updates["estimated_cost"] !== undefined ? updates["estimated_cost"] : sql`estimated_cost`},
          service_details = ${updates["service_details"] !== undefined ? updates["service_details"] : sql`service_details`},
          special_requirements = ${updates["special_requirements"] !== undefined ? updates["special_requirements"] : sql`special_requirements`},
          reviewed_by = COALESCE(reviewed_by, ${userId}),
          updated_at = NOW()
        WHERE id = ${req.params["id"]} AND org_id = ${orgId}
        RETURNING *
      `
        )
        .then(unwrapRows<ServiceRequestRow>);

      res.json(updated);
    })
  );

  app.post(
    "/api/work-orders/:id/service-requests",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_requests", "create"),
    writeOperationRateLimit,
    withErrorHandling(
      "create service request from work order",
      async (req: Request, res: Response) => {
        const orgId = getOrgId(req);
        const workOrderId = req.params["id"] ?? "";
        const userId = getUserId(req);

        const [wo] = await db
          .execute(
            sql`
        SELECT id, wo_number, description, vessel_id, status
        FROM work_orders
        WHERE id = ${workOrderId} AND org_id = ${orgId}
      `
          )
          .then(unwrapRows<ServiceRequestRow>);

        if (!wo) {
          return sendNotFound(res, "Work Order");
        }

        if (wo.status === "completed" || wo.status === "cancelled") {
          return res
            .status(400)
            .json({ error: `Cannot create a service request for a ${wo.status} work order` });
        }

        const [existingActive] = await db
          .execute(
            sql`
        SELECT id, request_number, status
        FROM service_requests
        WHERE work_order_id = ${workOrderId} AND org_id = ${orgId}
          AND status NOT IN ('rejected', 'converted')
        LIMIT 1
      `
          )
          .then(unwrapRows<ServiceRequestRow>);

        if (existingActive) {
          return res.status(409).json({
            error: `This work order already has an active service request (${existingActive.request_number}, status: ${existingActive.status}). Reject or convert it before creating a new one.`,
          });
        }

        const { title, description, urgency, estimatedCost, serviceDetails, specialRequirements } =
          req.body;
        if (!title) {
          return res.status(400).json({ error: "title is required" });
        }

        const previousWoStatus = wo.status;

        let newSr: ServiceRequestRow | undefined;
        const MAX_RETRIES = 3;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const [seqResult] = await db
              .execute(
                sql`
            SELECT COALESCE(
              MAX(CAST(SUBSTRING(request_number FROM 'SR-([0-9]+)') AS INTEGER)),
              0
            ) + 1 AS next_num
            FROM service_requests
            WHERE org_id = ${orgId}
          `
              )
              .then(unwrapRows<{ next_num: number | string | null }>);
            const requestNumber = `SR-${String(seqResult?.next_num || 1).padStart(4, "0")}`;

            const serviceRequestId = randomUUID();
            const [inserted] = await db
              .execute(
                sql`
            INSERT INTO service_requests (
              id, org_id, work_order_id, request_number,
              title, description, urgency, estimated_cost,
              service_details, special_requirements,
              requested_by, status, previous_wo_status,
              created_at, updated_at
            )
            VALUES (
              ${serviceRequestId},
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
          `
              )
              .then(unwrapRows<ServiceRequestRow>);
            newSr = inserted;
            break;
          } catch (err) {
            const pgErr = err as { code?: string; constraint?: string };
            if (
              pgErr.code === "23505" &&
              pgErr.constraint?.includes("service_requests") &&
              attempt < MAX_RETRIES - 1
            ) {
              logger.warn(`SR number collision on attempt ${attempt + 1}, retrying...`);
              continue;
            }
            throw err;
          }
        }

        if (!newSr) {
          return res
            .status(500)
            .json({ error: "Failed to generate unique request number after retries" });
        }

        const requestNumber = newSr.request_number;

        await db.execute(sql`
        UPDATE work_orders
        SET status = 'awaiting_service', updated_at = NOW()
        WHERE id = ${workOrderId} AND org_id = ${orgId}
          AND status NOT IN ('completed', 'cancelled', 'awaiting_service')
      `);

        domainEventBus.emit(
          "service_request.created",
          createDomainEvent(
            "service_request.created",
            orgId,
            {
              serviceRequestId: newSr.id,
              requestNumber,
              workOrderId,
              title,
              urgency: urgency || "medium",
              requestedBy: userId,
            },
            { userId, aggregateId: newSr.id, aggregateType: "ServiceRequest" }
          )
        );

        logger.info(
          `Created service request ${requestNumber} from work order ${workOrderId}, WO status changed to awaiting_service (was: ${previousWoStatus})`
        );
        sendCreated(res, newSr);
      }
    )
  );

  app.post(
    "/api/service-requests/:id/review",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_requests", "edit"),
    writeOperationRateLimit,
    withErrorHandling("review service request", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);

      const [sr] = await db
        .execute(
          sql`
        SELECT id, status, work_order_id, request_number FROM service_requests
        WHERE id = ${req.params["id"]} AND org_id = ${orgId}
      `
        )
        .then(unwrapRows<ServiceRequestRow>);

      if (!sr) {
        return sendNotFound(res, "Service Request");
      }

      if (sr.status !== "pending_review") {
        return res.status(400).json({ error: `Cannot review a request in '${sr.status}' status` });
      }

      const [updated] = await db
        .execute(
          sql`
        UPDATE service_requests
        SET status = 'under_review', reviewed_by = ${userId}, updated_at = NOW()
        WHERE id = ${req.params["id"]} AND org_id = ${orgId}
        RETURNING *
      `
        )
        .then(unwrapRows<ServiceRequestRow>);

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

      const [sr] = await db
        .execute(
          sql`
        SELECT id, status, work_order_id, title, description, estimated_cost, request_number
        FROM service_requests
        WHERE id = ${req.params["id"]} AND org_id = ${orgId}
      `
        )
        .then(unwrapRows<ServiceRequestRow>);

      if (!sr) {
        return sendNotFound(res, "Service Request");
      }

      if (sr.status !== "pending_review" && sr.status !== "under_review") {
        return res.status(400).json({ error: `Cannot approve a request in '${sr.status}' status` });
      }

      const [updated] = await db
        .execute(
          sql`
        UPDATE service_requests
        SET status = 'approved', reviewed_by = ${userId}, reviewed_at = NOW(), updated_at = NOW()
        WHERE id = ${req.params["id"]} AND org_id = ${orgId}
        RETURNING *
      `
        )
        .then(unwrapRows<ServiceRequestRow>);

      domainEventBus.emit(
        "service_request.approved",
        createDomainEvent(
          "service_request.approved",
          orgId,
          {
            serviceRequestId: sr.id,
            requestNumber: sr.request_number,
            workOrderId: sr.work_order_id,
            approvedBy: userId,
          },
          { userId, aggregateId: sr.id, aggregateType: "ServiceRequest" }
        )
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

      const [sr] = await db
        .execute(
          sql`
        SELECT id, status, work_order_id, request_number, previous_wo_status
        FROM service_requests
        WHERE id = ${req.params["id"]} AND org_id = ${orgId}
      `
        )
        .then(unwrapRows<ServiceRequestRow>);

      if (!sr) {
        return sendNotFound(res, "Service Request");
      }

      if (sr.status !== "pending_review" && sr.status !== "under_review") {
        return res.status(400).json({ error: `Cannot reject a request in '${sr.status}' status` });
      }

      const { reason } = req.body;

      const [updated] = await db
        .execute(
          sql`
        UPDATE service_requests
        SET
          status = 'rejected',
          rejection_reason = ${reason || null},
          reviewed_by = ${userId},
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${req.params["id"]} AND org_id = ${orgId}
        RETURNING *
      `
        )
        .then(unwrapRows<ServiceRequestRow>);

      const [otherActiveSr] = await db
        .execute(
          sql`
        SELECT id FROM service_requests
        WHERE work_order_id = ${sr.work_order_id} AND org_id = ${orgId}
          AND id != ${sr.id}
          AND status NOT IN ('rejected', 'converted')
        LIMIT 1
      `
        )
        .then(unwrapRows<ServiceRequestRow>);

      if (!otherActiveSr) {
        const restoreStatus = sr.previous_wo_status || "open";
        await db.execute(sql`
          UPDATE work_orders
          SET
            status = ${restoreStatus},
            updated_at = NOW()
          WHERE id = ${sr.work_order_id} AND org_id = ${orgId}
            AND status = 'awaiting_service'
        `);
        logger.info(`WO status restored to '${restoreStatus}' (no other active SRs)`);
      } else {
        logger.info(
          `WO status kept as 'awaiting_service' — other active SR ${otherActiveSr.id} remains`
        );
      }

      domainEventBus.emit(
        "service_request.rejected",
        createDomainEvent(
          "service_request.rejected",
          orgId,
          {
            serviceRequestId: sr.id,
            requestNumber: sr.request_number,
            workOrderId: sr.work_order_id,
            rejectedBy: userId,
            reason: reason || undefined,
          },
          { userId, aggregateId: sr.id, aggregateType: "ServiceRequest" }
        )
      );

      logger.info(`Service request ${req.params["id"]} rejected by ${userId}`);
      res.json(updated);
    })
  );

  app.post(
    "/api/service-requests/:id/convert",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_requests", "approve"),
    writeOperationRateLimit,
    withErrorHandling(
      "convert service request to service order",
      async (req: Request, res: Response) => {
        const orgId = getOrgId(req);
        const userId = getUserId(req);

        const [sr] = await db
          .execute(
            sql`
        SELECT sr.id, sr.status, sr.work_order_id, sr.title, sr.description,
               sr.estimated_cost, sr.request_number, sr.service_details, sr.special_requirements,
               wo.wo_number, wo.description AS wo_description,
               wo.equipment_id, wo.vessel_id
        FROM service_requests sr
        JOIN work_orders wo ON wo.id = sr.work_order_id AND wo.org_id = ${orgId}
        WHERE sr.id = ${req.params["id"]} AND sr.org_id = ${orgId}
      `
          )
          .then(unwrapRows<ServiceRequestRow>);

        if (!sr) {
          return sendNotFound(res, "Service Request");
        }

        if (sr.status !== "approved") {
          return res
            .status(400)
            .json({ error: `Can only convert approved requests. Current status: '${sr.status}'` });
        }

        const [wo] = await db
          .execute(
            sql`
        SELECT id, status FROM work_orders
        WHERE id = ${sr.work_order_id} AND org_id = ${orgId}
      `
          )
          .then(unwrapRows<ServiceRequestRow>);

        if (!wo) {
          return sendNotFound(res, "Work Order");
        }

        if (wo.status === "completed" || wo.status === "cancelled") {
          return res
            .status(400)
            .json({ error: `Cannot convert — the linked work order is already '${wo.status}'` });
        }

        const { serviceProviderId, scope, estimatedCost, scheduledStartDate, scheduledEndDate } =
          req.body;

        if (!serviceProviderId) {
          return res.status(400).json({ error: "serviceProviderId is required for conversion" });
        }

        if (scheduledStartDate && scheduledEndDate) {
          const start = new Date(scheduledStartDate);
          const end = new Date(scheduledEndDate);
          if (end <= start) {
            return res.status(400).json({ error: "Scheduled end date must be after start date" });
          }
        }

        const newSo = await createServiceOrderFromWorkOrder(db, {
          orgId,
          workOrderId: sr.work_order_id,
          woNumber: sr.wo_number ?? "",
          woDescription: sr.wo_description ?? null,
          serviceProviderId,
          scope: scope || sr.description || sr.wo_description || null,
          estimatedCost: estimatedCost
            ? Number(estimatedCost)
            : sr.estimated_cost
              ? Number(sr.estimated_cost)
              : null,
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
        WHERE id = ${req.params["id"]} AND org_id = ${orgId}
      `);

        domainEventBus.emit(
          "service_request.converted",
          createDomainEvent(
            "service_request.converted",
            orgId,
            {
              serviceRequestId: sr.id,
              requestNumber: sr.request_number,
              workOrderId: sr.work_order_id,
              serviceOrderId: newSo.id,
              soNumber: newSo.so_number,
              convertedBy: userId,
            },
            { userId, aggregateId: sr.id, aggregateType: "ServiceRequest" }
          )
        );

        logger.info(
          `Service request ${req.params["id"]} converted to SO ${newSo.so_number} by ${userId}`
        );
        res.json({
          serviceRequest: { id: req.params["id"], status: "converted", serviceOrderId: newSo.id },
          serviceOrder: newSo,
        });
      }
    )
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
