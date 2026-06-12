import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { checkPermissionInDev } from "../domains/permissions/middleware";
import { requireOrgIdAndValidateBody } from "../middleware/auth";
import { sendCreated, sendNotFound, withErrorHandling } from "../lib/route-utils";
import { createDomainEvent, domainEventBus } from "../lib/domain-event-bus";
import { logger } from "../utils/logger";
import {
  getOrgId,
  getUserId,
  type ServiceRequestRouteRateLimiters,
  type ServiceRequestRow,
  unwrapRows,
} from "./service-request-route-utils";

export function registerServiceRequestEditRoutes(
  app: Express,
  { writeOperationRateLimit }: Pick<ServiceRequestRouteRateLimiters, "writeOperationRateLimit">
) {
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
        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
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
              attempt < maxRetries - 1
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
}
