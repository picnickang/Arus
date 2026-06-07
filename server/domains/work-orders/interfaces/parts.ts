/**
 * Work Order Parts Routes
 *
 * Parts management: GET, POST, PUT, DELETE parts, bulk add with inventory reservation.
 * Permission-based access control using RBAC permission system.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { workOrderAppService as workOrderService } from "../application";
import { authenticatedRequest, requireOrgId } from "../../../middleware/auth";
import { requirePartsManagementRole } from "../../../middleware/role-auth";
import { requirePermission } from "../../permissions/middleware";
import { withErrorHandling, sendCreated, sendDeleted } from "../../../lib/route-utils";
import { sendBadRequest, sendConflict } from "../../../lib/api-helpers";
import type { RateLimitMiddleware } from "./types";
import { dbInventoryStorage } from "../../../db/inventory/index.js";

const idParamSchema = z.object({ id: z.string().min(1) });
const woPartParamSchema = z.object({
  workOrderId: z.string().min(1),
  partId: z.string().min(1),
});
const partOnlyParamSchema = z.object({ partId: z.string().min(1) });

const partBodySchema = z
  .object({
    partId: z.string().min(1),
    quantity: z.number().positive(),
    usedBy: z.string().min(1),
    notes: z.string().optional(),
  });

const bulkPartsBodySchema = z.object({
  parts: z
    .array(
      z.object({
        partId: z.string().min(1),
        quantity: z.number().positive(),
        usedBy: z.string().min(1),
      })
    )
    .min(1),
});

const extendCompletionBodySchema = z.object({
  additionalDays: z.number().positive(),
  reason: z.string().optional(),
});

export function registerPartsRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const { writeOperationRateLimit } = rateLimit;

  app.get(
    "/api/work-orders/:id/parts",
    requireOrgId,
    withErrorHandling("fetch work order parts", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const parts = await workOrderService.getWorkOrderParts(id, orgId);
      return res.json(parts);
    })
  );

  app.post(
    "/api/work-orders/:id/parts",
    requireOrgId,
    requirePartsManagementRole(),
    requirePermission("work_orders", "create"),
    writeOperationRateLimit,
    withErrorHandling("add part to work order", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const body = partBodySchema.parse(req.body);
      const partData = {
        ...body,
        orgId,
        workOrderId: id,
      };

      const part = await workOrderService.addBulkPartsAndReserveInventory(
        id,
        [partData] as Parameters<typeof workOrderService.addBulkPartsAndReserveInventory>[1],
        orgId
      );
      sendCreated(res, part);
    })
  );

  app.post(
    "/api/work-orders/:id/parts/bulk",
    requireOrgId,
    requirePartsManagementRole(),
    writeOperationRateLimit,
    withErrorHandling("add bulk parts to work order", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const parsed = bulkPartsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return sendBadRequest(res, "Parts array is required and each part must have partId, quantity, usedBy");
      }
      const { parts } = parsed.data;

      const result = await workOrderService.addBulkPartsAndReserveInventory(
        id,
        parts as Parameters<typeof workOrderService.addBulkPartsAndReserveInventory>[1],
        orgId
      );

      const totalSuccess = result.added.length + result.updated.length;
      if (totalSuccess === 0 && result.errors.length > 0) {
        return sendConflict(res, "All parts failed to add");
      }

      sendCreated(res, {
        success: true,
        partialFailure: result.errors.length > 0,
        summary: {
          added: result.added.length,
          updated: result.updated.length,
          errors: result.errors.length,
        },
        details: result,
      });
    })
  );

  app.put(
    "/api/work-orders/:workOrderId/parts/:partId",
    requireOrgId,
    requirePartsManagementRole(),
    writeOperationRateLimit,
    withErrorHandling("update work order part", async (req: Request, res: Response) => {
      const { partId } = woPartParamSchema.parse(req.params);
      const body = partBodySchema.parse(req.body);
      const updatedPart = await workOrderService.updateWorkOrderPart(
        partId,
        body as Parameters<typeof workOrderService.updateWorkOrderPart>[1]
      );
      return res.json(updatedPart);
    })
  );

  app.delete(
    "/api/work-orders/:workOrderId/parts/:partId",
    requireOrgId,
    requirePartsManagementRole(),
    writeOperationRateLimit,
    withErrorHandling("remove work order part", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const orgId = authReq.orgId;
      const performedBy = authReq.user?.name || authReq.user?.email || "System";
      const { partId } = woPartParamSchema.parse(req.params);

      await workOrderService.removePartAndRestoreInventory(partId, orgId, performedBy);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/work-orders/:id/parts/costs",
    requireOrgId,
    withErrorHandling("fetch work order parts costs", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      const costs = await workOrderService.getPartsCostForWorkOrder(id);
      return res.json(costs);
    })
  );

  app.get(
    "/api/parts/:partId/stock-status",
    requireOrgId,
    withErrorHandling(
      "fetch part stock status with lead time",
      async (req: Request, res: Response) => {
        const orgId = authenticatedRequest(req).orgId;
        const { partId } = partOnlyParamSchema.parse(req.params);
        const stockStatus = await dbInventoryStorage.getPartStockWithSupplierLeadTime(
          partId,
          orgId
        );
        if (!stockStatus) {
          return res.status(404).json({ error: "Part not found" });
        }
        return res.json(stockStatus);
      }
    )
  );

  app.patch(
    "/api/work-orders/:id/extend-completion-date",
    requireOrgId,
    requirePartsManagementRole(),
    writeOperationRateLimit,
    withErrorHandling(
      "extend work order completion date for pending parts",
      async (req: Request, res: Response) => {
        const orgId = authenticatedRequest(req).orgId;
        const { id } = idParamSchema.parse(req.params);
        const parsed = extendCompletionBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return sendBadRequest(res, "additionalDays must be a positive number");
        }
        const { additionalDays, reason } = parsed.data;

        const workOrder = await workOrderService.getWorkOrderById(id, orgId);
        if (!workOrder) {
          return res.status(404).json({ error: "Work order not found" });
        }

        const currentEndDate = workOrder.plannedEndDate
          ? new Date(workOrder.plannedEndDate)
          : new Date();
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + additionalDays);

        const updated = await workOrderService.updateWorkOrder(id, {
          plannedEndDate: newEndDate,
        } as Parameters<typeof workOrderService.updateWorkOrder>[1]);

        await dbInventoryStorage.addWorkOrderHistoryEntry({
          orgId,
          workOrderId: id,
          eventType: "completion_date_extended",
          description:
            reason || `Completion date extended by ${additionalDays} days for pending parts`,
          performedBy: authenticatedRequest(req).user?.name || "System",
          previousValue: JSON.stringify({ plannedEndDate: workOrder.plannedEndDate }),
          newValue: JSON.stringify({ plannedEndDate: newEndDate.toISOString() }),
        } as Parameters<typeof dbInventoryStorage.addWorkOrderHistoryEntry>[0]);

        return res.json(updated);
      }
    )
  );
}
