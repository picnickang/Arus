// @ts-nocheck
/**
 * Work Order Extended Routes
 *
 * Clone, history, and costs management.
 */

import type { Express, Request, Response } from "express";
import { insertMaintenanceCostSchema } from "@shared/schema-runtime";
import { workOrderAppService as workOrderService } from "../application";
import { requireOrgId, AuthenticatedRequest } from "../../../middleware/auth";
import { recordAndPublish } from "../../../sync-events";
import { cloneWorkOrderSchema } from "./schemas";
import { withErrorHandling, sendNotFound, sendCreated } from "../../../lib/route-utils";
import { validateBody, sendValidationError, sendBadRequest } from "../../../lib/api-helpers";
import type { RateLimitMiddleware } from "./types";

export function registerExtendedRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const { writeOperationRateLimit } = rateLimit;

  app.post(
    "/api/work-orders/:id/clone",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("clone work order", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const workOrderId = req.params.id;

      const validation = validateBody(req, cloneWorkOrderSchema);
      if (!validation.success) {
        return sendValidationError(res, validation.error, "Invalid clone options");
      }

      const validatedData = validation.data;
      const options: {
        plannedStartDate?: Date;
        plannedEndDate?: Date;
        includeTasks?: boolean;
        includeParts?: boolean;
      } = {
        includeTasks: validatedData.includeTasks ?? true,
        includeParts: validatedData.includeParts ?? true,
      };

      if (validatedData.plannedStartDate !== undefined && validatedData.plannedStartDate !== null) {
        options.plannedStartDate = new Date(validatedData.plannedStartDate);
      }

      if (validatedData.plannedEndDate !== undefined && validatedData.plannedEndDate !== null) {
        options.plannedEndDate = new Date(validatedData.plannedEndDate);
      }

      const clonedWorkOrder = await workOrderService.cloneWorkOrder(workOrderId, orgId, options);
      await recordAndPublish(
        "work_order",
        clonedWorkOrder.id,
        "create",
        clonedWorkOrder,
        (req as AuthenticatedRequest).user?.id
      );

      sendCreated(res, clonedWorkOrder);
    })
  );

  app.get(
    "/api/work-orders/:id/history",
    requireOrgId,
    withErrorHandling("fetch work order history", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const workOrderId = req.params.id;

      const historyEntries = await workOrderService.getWorkOrderHistory(workOrderId, orgId);
      const inventoryMovements = await workOrderService.getInventoryMovementsByWorkOrder(
        workOrderId,
        orgId
      );

      res.json({
        history: historyEntries,
        inventoryMovements,
      });
    })
  );

  app.post(
    "/api/work-orders/:id/costs",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create maintenance cost", async (req: Request, res: Response) => {
      const costData = insertMaintenanceCostSchema.parse({
        ...req.body,
        workOrderId: req.params.id,
      });
      const cost = await workOrderService.createMaintenanceCost(costData);
      sendCreated(res, cost);
    })
  );

  app.get(
    "/api/work-orders/:id/costs",
    requireOrgId,
    withErrorHandling("fetch maintenance costs", async (req: Request, res: Response) => {
      const costs = await workOrderService.getMaintenanceCostsByWorkOrder(req.params.id);
      res.json(costs);
    })
  );

  app.post(
    "/api/work-orders/:id/purchase-requests",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create purchase request", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const workOrderId = req.params.id;
      const workOrder = await workOrderService.getWorkOrderById(workOrderId, orgId);
      if (!workOrder) {
        return sendNotFound(res, "Work order");
      }

      const { supplierId, items, notes, priority, requestedDeliveryDate } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return sendBadRequest(res, "At least one item is required");
      }

      const purchaseRepo = await import("../../../purchasing/repository");
      const requestNumber = await purchaseRepo.generateRequestNumber(orgId);
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id || (req.headers["x-user-id"] as string) || "system";
      const pr = await purchaseRepo.createPurchaseRequest({
        orgId,
        workOrderId,
        requestNumber,
        requestedBy: userId,
        vesselId: workOrder.vesselId,
        supplierId: supplierId || undefined,
        notes: notes || undefined,
        requiredByDate: requestedDeliveryDate ? new Date(requestedDeliveryDate) : undefined,
        status: "draft",
      });

      const createdItems = [];
      const skippedItems: Array<{ description?: string; reason: string }> = [];
      for (const item of items) {
        if (item.partId) {
          const createdItem = await purchaseRepo.addPurchaseRequestItem({
            orgId,
            prId: pr.id,
            partId: item.partId,
            supplierId: item.supplierId,
            quantity: item.quantity || 1,
            uom: item.uom,
            remarks: item.notes || item.description,
          });
          createdItems.push(createdItem);
        } else {
          skippedItems.push({
            description: item.description,
            reason: "partId is required for purchase request items",
          });
        }
      }

      sendCreated(res, {
        ...pr,
        items: createdItems,
        skippedItems: skippedItems.length > 0 ? skippedItems : undefined,
      });
    })
  );

  app.get(
    "/api/work-orders/:id/purchase-requests",
    requireOrgId,
    withErrorHandling("fetch purchase requests", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const purchaseRepo = await import("../../../purchasing/repository");
      const prs = await purchaseRepo.listPurchaseRequests({ orgId, workOrderId: req.params.id });
      res.json(prs);
    })
  );

  app.get(
    "/api/work-orders/:id/procurement-costs",
    requireOrgId,
    withErrorHandling("fetch procurement costs", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const workOrderId = req.params.id;

      const { getWorkOrderProcurementCosts } = await import("../../../cost-savings-engine");
      const costs = await getWorkOrderProcurementCosts(workOrderId, orgId);
      res.json(costs);
    })
  );

  app.post(
    "/api/work-orders/:id/aggregate-procurement-costs",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("aggregate procurement costs", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const workOrderId = req.params.id;

      const { aggregateProcurementCostsToWorkOrder } = await import("../../../cost-savings-engine");
      const result = await aggregateProcurementCostsToWorkOrder(workOrderId, orgId);
      res.json(result);
    })
  );
}
