/**
 * Work Order Parts Routes
 *
 * Parts management: GET, POST, PUT, DELETE parts, bulk add with inventory reservation.
 * Permission-based access control using RBAC permission system.
 */

import type { Express, Request, Response } from "express";
import { workOrderAppService as workOrderService } from "../application";
import { requireOrgId, AuthenticatedRequest } from "../../../middleware/auth";
import { requirePartsManagementRole } from "../../../middleware/role-auth";
import { requirePermission } from "../../permissions/middleware";
import { withErrorHandling, sendCreated, sendDeleted } from "../../../lib/route-utils";
import { sendBadRequest, sendConflict } from "../../../lib/api-helpers";
import type { RateLimitMiddleware } from "./types";
import { dbInventoryStorage } from "../../../db/inventory/index.js";

export function registerPartsRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const { writeOperationRateLimit } = rateLimit;

  // Read operation - requires read permission on work_orders resource
  app.get("/api/work-orders/:id/parts", requireOrgId,
    withErrorHandling("fetch work order parts", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const parts = await workOrderService.getWorkOrderParts(req.params.id, orgId);
      res.json(parts);
    })
  );

  // Write operation - requires create permission on work_orders resource
  // Uses both legacy role check (for backward compatibility) and new RBAC permission system
  app.post("/api/work-orders/:id/parts", 
    requireOrgId, 
    requirePartsManagementRole(), // Legacy fallback: Chief Engineer, Second Engineer
    requirePermission("work_orders", "create"), // New RBAC permission check
    writeOperationRateLimit,
    withErrorHandling("add part to work order", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const partData = {
        ...req.body,
        orgId,
        workOrderId: req.params.id,
      };

      const part = await workOrderService.addBulkPartsToWorkOrder(partData);
      sendCreated(res, part);
    })
  );

  app.post("/api/work-orders/:id/parts/bulk", requireOrgId, requirePartsManagementRole(), writeOperationRateLimit,
    withErrorHandling("add bulk parts to work order", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { parts } = req.body;

      if (!Array.isArray(parts) || parts.length === 0) {
        return sendBadRequest(res, "Parts array is required and cannot be empty");
      }

      for (const part of parts) {
        if (!part.partId || !part.quantity || !part.usedBy) {
          return sendBadRequest(res, "Each part must have partId, quantity, and usedBy fields");
        }

        if (typeof part.quantity !== "number" || part.quantity <= 0) {
          return sendBadRequest(res, "Quantity must be a positive number");
        }
      }

      const result = await workOrderService.addBulkPartsAndReserveInventory(req.params.id, parts, orgId);

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

  app.put("/api/work-orders/:workOrderId/parts/:partId", requireOrgId, requirePartsManagementRole(), writeOperationRateLimit,
    withErrorHandling("update work order part", async (req: Request, res: Response) => {
      const updatedPart = await workOrderService.updateWorkOrderPart(req.params.partId, req.body);
      res.json(updatedPart);
    })
  );

  app.delete("/api/work-orders/:workOrderId/parts/:partId", requireOrgId, requirePartsManagementRole(), writeOperationRateLimit,
    withErrorHandling("remove work order part", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const orgId = authReq.orgId;
      const performedBy = authReq.user?.name || authReq.user?.email || "System";
      
      await workOrderService.removePartAndRestoreInventory(req.params.partId, orgId, performedBy);
      sendDeleted(res);
    })
  );

  app.get("/api/work-orders/:id/parts/costs", requireOrgId,
    withErrorHandling("fetch work order parts costs", async (req: Request, res: Response) => {
      const costs = await workOrderService.getPartsCostForWorkOrder(req.params.id);
      res.json(costs);
    })
  );

  app.get("/api/parts/:partId/stock-status", requireOrgId,
    withErrorHandling("fetch part stock status with lead time", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const stockStatus = await dbInventoryStorage.getPartStockWithSupplierLeadTime(req.params.partId, orgId);
      if (!stockStatus) {
        return res.status(404).json({ error: "Part not found" });
      }
      res.json(stockStatus);
    })
  );

  app.patch("/api/work-orders/:id/extend-completion-date", requireOrgId, requirePartsManagementRole(), writeOperationRateLimit,
    withErrorHandling("extend work order completion date for pending parts", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { additionalDays, reason } = req.body;
      
      if (typeof additionalDays !== "number" || additionalDays <= 0) {
        return sendBadRequest(res, "additionalDays must be a positive number");
      }
      
      const workOrder = await workOrderService.getWorkOrderById(req.params.id, orgId);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      
      const currentEndDate = workOrder.plannedEndDate ? new Date(workOrder.plannedEndDate) : new Date();
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + additionalDays);
      
      const updated = await workOrderService.updateWorkOrder(req.params.id, {
        plannedEndDate: newEndDate.toISOString(),
      });
      
      await dbInventoryStorage.addWorkOrderHistoryEntry({
        orgId,
        workOrderId: req.params.id,
        changeType: "completion_date_extended",
        description: reason || `Completion date extended by ${additionalDays} days for pending parts`,
        changedBy: (req as AuthenticatedRequest).user?.name || "System",
        previousValue: JSON.stringify({ plannedEndDate: workOrder.plannedEndDate }),
        newValue: JSON.stringify({ plannedEndDate: newEndDate.toISOString() }),
      });
      
      res.json(updated);
    })
  );
}
