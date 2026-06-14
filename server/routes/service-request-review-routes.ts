import type { Express, Request, Response } from "express";
import { checkPermissionInDev } from "../domains/permissions/middleware";
import { requireOrgIdAndValidateBody } from "../middleware/auth";
import { sendNotFound, withErrorHandling } from "../lib/route-utils";
import { createDomainEvent, domainEventBus } from "../lib/domain-event-bus";
import { logger } from "../utils/logger";
import {
  approveServiceRequest,
  convertServiceRequestToServiceOrder,
  getOtherActiveServiceRequest,
  getServiceRequestForApproval,
  getServiceRequestForConversion,
  getServiceRequestForRejection,
  getServiceRequestForReview,
  getWorkOrderStatusRow,
  rejectServiceRequest,
  restoreWorkOrderStatus,
  setServiceRequestUnderReview,
} from "../db/service-requests/review-repository";
import {
  getOrgId,
  getUserId,
  type ServiceRequestRouteRateLimiters,
} from "./service-request-route-utils";

export function registerServiceRequestReviewRoutes(
  app: Express,
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
      const id = req.params["id"] ?? "";

      const sr = await getServiceRequestForReview(id, orgId);

      if (!sr) {
        return sendNotFound(res, "Service Request");
      }

      if (sr.status !== "pending_review") {
        return res.status(400).json({ error: `Cannot review a request in '${sr.status}' status` });
      }

      const updated = await setServiceRequestUnderReview(id, orgId, userId);

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
      const id = req.params["id"] ?? "";

      const sr = await getServiceRequestForApproval(id, orgId);

      if (!sr) {
        return sendNotFound(res, "Service Request");
      }

      if (sr.status !== "pending_review" && sr.status !== "under_review") {
        return res.status(400).json({ error: `Cannot approve a request in '${sr.status}' status` });
      }

      const updated = await approveServiceRequest(id, orgId, userId);

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
      const id = req.params["id"] ?? "";

      const sr = await getServiceRequestForRejection(id, orgId);

      if (!sr) {
        return sendNotFound(res, "Service Request");
      }

      if (sr.status !== "pending_review" && sr.status !== "under_review") {
        return res.status(400).json({ error: `Cannot reject a request in '${sr.status}' status` });
      }

      const { reason } = req.body;

      const updated = await rejectServiceRequest(id, orgId, userId, reason || null);

      const otherActiveSr = await getOtherActiveServiceRequest(sr.work_order_id, sr.id, orgId);

      if (!otherActiveSr) {
        const restoreStatus = sr.previous_wo_status || "open";
        await restoreWorkOrderStatus(sr.work_order_id, orgId, restoreStatus);
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

      logger.info(`Service request ${id} rejected by ${userId}`);
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
        const id = req.params["id"] ?? "";

        const sr = await getServiceRequestForConversion(id, orgId);

        if (!sr) {
          return sendNotFound(res, "Service Request");
        }

        if (sr.status !== "approved") {
          return res
            .status(400)
            .json({ error: `Can only convert approved requests. Current status: '${sr.status}'` });
        }

        const wo = await getWorkOrderStatusRow(sr.work_order_id, orgId);

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

        const newSo = await convertServiceRequestToServiceOrder(id, orgId, userId, {
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
        });

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

        logger.info(`Service request ${id} converted to SO ${newSo.so_number} by ${userId}`);
        res.json({
          serviceRequest: { id, status: "converted", serviceOrderId: newSo.id },
          serviceOrder: newSo,
        });
      }
    )
  );
}
