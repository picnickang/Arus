import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { checkPermissionInDev } from "../domains/permissions/middleware";
import { requireOrgIdAndValidateBody } from "../middleware/auth";
import { sendNotFound, withErrorHandling } from "../lib/route-utils";
import { createDomainEvent, domainEventBus } from "../lib/domain-event-bus";
import { logger } from "../utils/logger";
import { createServiceOrderFromWorkOrder } from "./wo-so-bridge-routes";
import {
  getOrgId,
  getUserId,
  type ServiceRequestDb,
  type ServiceRequestRouteRateLimiters,
  type ServiceRequestRow,
  unwrapRows,
} from "./service-request-route-utils";

export function registerServiceRequestReviewRoutes(
  app: Express,
  db: ServiceRequestDb,
  { writeOperationRateLimit }: Pick<ServiceRequestRouteRateLimiters, "writeOperationRateLimit">
) {
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
}
