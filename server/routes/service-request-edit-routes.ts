import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { checkPermissionInDev } from "../domains/permissions/middleware";
import { requireOrgIdAndValidateBody } from "../middleware/auth";
import { sendCreated, sendNotFound, withErrorHandling } from "../lib/route-utils";
import { createDomainEvent, domainEventBus } from "../lib/domain-event-bus";
import { logger } from "../utils/logger";
import {
  getActiveServiceRequestForWorkOrder,
  getServiceRequestStatusRow,
  getWorkOrderForServiceRequest,
  generateServiceRequestNumber,
  insertServiceRequestRow,
  markWorkOrderAwaitingService,
  updateServiceRequestFields,
} from "../db/service-requests/repository";
import {
  getOrgId,
  getUserId,
  type ServiceRequestRouteRateLimiters,
  type ServiceRequestRow,
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
      const id = req.params["id"] ?? "";

      const sr = await getServiceRequestStatusRow(id, orgId);

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

      const updated = await updateServiceRequestFields(id, orgId, userId, updates);

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

        const wo = await getWorkOrderForServiceRequest(workOrderId, orgId);

        if (!wo) {
          return sendNotFound(res, "Work Order");
        }

        if (wo.status === "completed" || wo.status === "cancelled") {
          return res
            .status(400)
            .json({ error: `Cannot create a service request for a ${wo.status} work order` });
        }

        const existingActive = await getActiveServiceRequestForWorkOrder(workOrderId, orgId);

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
            const requestNumber = await generateServiceRequestNumber(orgId);
            const serviceRequestId = randomUUID();
            newSr = await insertServiceRequestRow({
              serviceRequestId,
              orgId,
              workOrderId,
              requestNumber,
              title,
              description: description || null,
              urgency: urgency || "medium",
              estimatedCost: estimatedCost ? Number(estimatedCost) : null,
              serviceDetails: serviceDetails || null,
              specialRequirements: specialRequirements || null,
              requestedBy: userId,
              previousWoStatus,
            });
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

        await markWorkOrderAwaitingService(workOrderId, orgId);

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
