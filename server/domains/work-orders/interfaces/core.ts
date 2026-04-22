/**
 * Work Orders Core Routes
 *
 * Basic CRUD operations for work orders: list, get, create, update, delete.
 */

import type { Express, Request, Response } from "express";
import { insertWorkOrderSchema, updateWorkOrderSchema } from "@shared/schema-runtime";
import { workOrderAppService as workOrderService } from "../application";
import { safeDbOperation } from "../../../error-handling";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../../middleware/auth";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils";
import {
  parsePagination,
  paginatedResponse,
  parseDateRange,
  sendValidationError,
  sendBadRequest,
} from "../../../lib/api-helpers";
import type { RateLimitMiddleware } from "./types";

export function registerCoreRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const { writeOperationRateLimit, criticalOperationRateLimit } = rateLimit;

  app.get(
    "/api/work-orders",
    requireOrgId,
    withErrorHandling("fetch work orders", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.query.equipmentId as string;
      const { startDate, endDate } = parseDateRange(req.query as Record<string, unknown>);

      const filters = {
        vesselId: (req.query.vesselId as string) || undefined,
        assignedCrewId: (req.query.engineerId as string) || undefined,
        status: (req.query.status as string) || undefined,
        priority: (req.query.priority as string) || undefined,
        dueDateFrom: startDate ? new Date(startDate) : undefined,
        dueDateTo: endDate ? new Date(endDate) : undefined,
        equipmentCategory: (req.query.equipmentCategory as string) || undefined,
        search: (req.query.search as string) || undefined,
        workOrderType: (req.query.workOrderType as string) || undefined,
      };

      const isPaginated = req.query.limit !== undefined || req.query.offset !== undefined;

      if (isPaginated) {
        const paginationResult = parsePagination(req.query as Record<string, unknown>);

        if (!paginationResult.success) {
          return sendValidationError(res, paginationResult.error, "Invalid pagination parameters");
        }

        const pagination = paginationResult.params;

        if (pagination.limit < 1 || pagination.limit > 100) {
          return sendBadRequest(res, "Limit must be between 1 and 100");
        }

        const result = await workOrderService.listWorkOrdersPaginated(
          equipmentId,
          orgId,
          pagination.limit,
          pagination.offset,
          filters
        );

        res.json(paginatedResponse(result.items, pagination, result.total));
      } else {
        const workOrders = await workOrderService.listWorkOrders(equipmentId, orgId, filters);
        res.json(workOrders);
      }
    })
  );

  app.get(
    "/api/work-orders/summary",
    requireOrgId,
    withErrorHandling("fetch work order summary", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const workOrders = await workOrderService.listWorkOrders(undefined, orgId);
      const now = new Date();

      const total = workOrders.length;
      const open = workOrders.filter(
        (wo: any) => wo.status === "open" || wo.status === "in_progress" || wo.status === "pending"
      ).length;
      const completed = workOrders.filter(
        (wo: any) => wo.status === "completed" || wo.status === "closed"
      ).length;
      const overdue = workOrders.filter((wo: any) => {
        if (wo.status === "completed" || wo.status === "closed" || wo.status === "cancelled") {
          return false;
        }
        if (!wo.nextScheduledDate && !wo.plannedEndDate) {
          return false;
        }
        const dueDate = new Date(wo.nextScheduledDate || wo.plannedEndDate);
        return dueDate < now;
      }).length;
      const highPriority = workOrders.filter(
        (wo: any) => wo.priority === 1 || wo.priority === "high" || wo.priority === "critical"
      ).length;

      res.json({ total, open, completed, overdue, overdueCount: overdue, highPriority });
    })
  );

  app.get(
    "/api/work-orders/:id",
    requireOrgId,
    withErrorHandling("fetch work order", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const workOrder = await workOrderService.getWorkOrderById(req.params.id, orgId);

      if (!workOrder) {
        return sendNotFound(res, "Work order");
      }

      res.json(workOrder);
    })
  );

  app.post(
    "/api/work-orders",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create work order", async (req: Request, res: Response) => {
      const processedBody = {
        ...req.body,
        scheduledDate: req.body.nextScheduledDate
          ? new Date(req.body.nextScheduledDate)
          : undefined,
        completedDate: req.body.completedDate ? new Date(req.body.completedDate) : undefined,
        plannedStartDate: req.body.plannedStartDate
          ? new Date(req.body.plannedStartDate)
          : undefined,
        plannedEndDate: req.body.plannedEndDate ? new Date(req.body.plannedEndDate) : undefined,
      };

      const orderData = insertWorkOrderSchema.parse(processedBody);

      const workOrder = await safeDbOperation(
        () => workOrderService.createWorkOrder(orderData, (req as AuthenticatedRequest).user?.id),
        "createWorkOrder"
      );

      sendCreated(res, workOrder);
    })
  );

  app.post(
    "/api/work-orders/with-suggestions",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create work order with suggestions", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const orderData = insertWorkOrderSchema.parse(req.body);

      const result = await safeDbOperation(
        () =>
          workOrderService.createWorkOrderWithSuggestions(
            orderData,
            orgId,
            (req as AuthenticatedRequest).user?.id
          ),
        "createWorkOrderWithSuggestions"
      );

      sendCreated(res, result);
    })
  );

  app.put(
    "/api/work-orders/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update work order", async (req: Request, res: Response) => {
      const parsed = updateWorkOrderSchema.parse(req.body);
      const orderData: Record<string, any> = { ...parsed };
      const dateFields = [
        "plannedStartDate",
        "plannedEndDate",
        "actualStartDate",
        "actualEndDate",
      ] as const;
      for (const f of dateFields) {
        if (orderData[f] != null) {
          orderData[f] = new Date(orderData[f]);
        }
      }
      const orgId = (req as AuthenticatedRequest).orgId;
      const workOrder = await workOrderService.updateWorkOrder(
        req.params.id,
        orderData,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );

      res.json(workOrder);
    })
  );

  app.delete(
    "/api/work-orders/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete work order", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      await workOrderService.deleteWorkOrder(
        req.params.id,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );
      sendDeleted(res);
    })
  );
}
