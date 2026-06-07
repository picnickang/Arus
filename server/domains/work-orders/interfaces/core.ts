/**
 * Work Orders Core Routes
 *
 * Basic CRUD operations for work orders: list, get, create, update, delete.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { insertWorkOrderSchema, updateWorkOrderSchema } from "@shared/schema-runtime";
import { workOrderAppService as workOrderService } from "../application";
import { safeDbOperation } from "../../../error-handling";
import { authenticatedRequest, requireOrgId,
  requireOrgIdAndValidateBody, } from "../../../middleware/auth";
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
  sendForbidden,
  sendUnauthorized,
} from "../../../lib/api-helpers";
import type { RateLimitMiddleware } from "./types";

const idParamSchema = z.object({ id: z.string().min(1) });
const assignmentResponseSchema = z.object({
  response: z.enum(["accept", "decline"]),
  reason: z.string().max(1000).optional(),
});
const listQuerySchema = z.object({
  equipmentId: z.string().optional(),
  vesselId: z.string().optional(),
  engineerId: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  equipmentCategory: z.string().optional(),
  search: z.string().optional(),
  workOrderType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().optional(),
  offset: z.coerce.number().int().optional(),
});

export function registerCoreRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const { writeOperationRateLimit, criticalOperationRateLimit } = rateLimit;

  app.get(
    "/api/work-orders",
    requireOrgId,
    withErrorHandling("fetch work orders", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const query = listQuerySchema.parse(req.query);
      const equipmentId = query.equipmentId ?? "";
      const { startDate, endDate } = parseDateRange(query);

      const filters = {
        vesselId: query.vesselId,
        assignedCrewId: query.engineerId,
        status: query.status,
        priority: query.priority,
        dueDateFrom: startDate ? new Date(startDate) : undefined,
        dueDateTo: endDate ? new Date(endDate) : undefined,
        equipmentCategory: query.equipmentCategory,
        search: query.search,
        workOrderType: query.workOrderType,
      };

      const isPaginated = query.limit !== undefined || query.offset !== undefined;

      if (isPaginated) {
        const paginationResult = parsePagination(query);

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
      const orgId = authenticatedRequest(req).orgId;
      const workOrders = await workOrderService.listWorkOrders(undefined, orgId);
      const now = new Date();

      type WO = {
        status?: string | null;
        scheduledDate?: Date | string | null;
        plannedEndDate?: Date | string | null;
        priority?: number | string | null;
      };
      const wos = workOrders as object as WO[];
      const total = wos.length;
      const open = wos.filter(
        (wo) => wo.status === "open" || wo.status === "in_progress" || wo.status === "pending"
      ).length;
      const completed = wos.filter(
        (wo) => wo.status === "completed" || wo.status === "closed"
      ).length;
      const overdue = wos.filter((wo) => {
        if (wo.status === "completed" || wo.status === "closed" || wo.status === "cancelled") {
          return false;
        }
        if (!wo.scheduledDate && !wo.plannedEndDate) {
          return false;
        }
        const dueDate = new Date((wo.scheduledDate || wo.plannedEndDate) as Date | string);
        return dueDate < now;
      }).length;
      const highPriority = wos.filter(
        (wo) => wo.priority === 1 || wo.priority === "high" || wo.priority === "critical"
      ).length;

      res.json({ total, open, completed, overdue, overdueCount: overdue, highPriority });
    })
  );

  // Crew-facing: the work orders assigned to the logged-in user (resolved
  // via their linked crew record). Registered BEFORE "/:id" so the literal
  // path is not swallowed by the dynamic param route.
  app.get(
    "/api/work-orders/my-assignments",
    requireOrgId,
    withErrorHandling("fetch my work order assignments", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const userId = authReq.user?.id;
      if (!userId) {
        return sendUnauthorized(res);
      }
      const assignments = await workOrderService.getAssignmentsForUser(userId, authReq.orgId);
      res.json(assignments);
    })
  );

  // Crew-facing: accept or decline an assignment. Declining requires a
  // non-empty reason so a supervisor knows why and can reassign.
  app.post(
    "/api/work-orders/:id/assignment-response",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("respond to work order assignment", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const userId = authReq.user?.id;
      if (!userId) {
        return sendUnauthorized(res);
      }
      const { id } = idParamSchema.parse(req.params);
      const body = assignmentResponseSchema.parse(req.body);
      const reason = body.reason?.trim();
      if (body.response === "decline" && !reason) {
        return sendBadRequest(res, "A reason is required to decline an assignment");
      }

      const result = await workOrderService.respondToAssignment(
        id,
        userId,
        authReq.orgId,
        body.response,
        reason
      );

      switch (result.status) {
        case "ok":
          return res.json(result.workOrder);
        case "not_crew":
          return sendForbidden(res, "You are not registered as a crew member for this organization");
        case "not_found":
          return sendNotFound(res, "Work order");
        case "no_assignment":
          return sendBadRequest(res, "This work order is not assigned to a crew member");
        case "forbidden":
          return sendForbidden(res, "This work order is not assigned to you");
      }
    })
  );

  app.get(
    "/api/work-orders/:id",
    requireOrgId,
    withErrorHandling("fetch work order", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const workOrder = await workOrderService.getWorkOrderById(id, orgId);

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
      const rawBody = jsonRecordSchema.parse(req.body);
      const toDate = (v: unknown) =>
        v == null ? undefined : new Date(v as string | number | Date);
      const processedBody = {
        ...rawBody,
        scheduledDate: toDate(rawBody['scheduledDate']),
        completedDate: toDate(rawBody['completedDate']),
        plannedStartDate: toDate(rawBody['plannedStartDate']),
        plannedEndDate: toDate(rawBody['plannedEndDate']),
      };

      const orderData = insertWorkOrderSchema.parse(processedBody);

      const workOrder = await safeDbOperation(
        () => workOrderService.createWorkOrder(orderData, authenticatedRequest(req).user?.id),
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
      const orgId = authenticatedRequest(req).orgId;
      const orderData = insertWorkOrderSchema.parse(req.body);

      const result = await safeDbOperation(
        () =>
          workOrderService.createWorkOrderWithSuggestions(
            orderData,
            orgId,
            authenticatedRequest(req).user?.id
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
      const orderData: Record<string, unknown> = { ...parsed };
      const dateFields = [
        "plannedStartDate",
        "plannedEndDate",
        "actualStartDate",
        "actualEndDate",
      ] as const;
      for (const f of dateFields) {
        const v = orderData[f];
        if (v != null) {
          orderData[f] = new Date(v as string | number | Date);
        }
      }
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const workOrder = await workOrderService.updateWorkOrder(
        id,
        orderData,
        orgId,
        authenticatedRequest(req).user?.id
      );

      res.json(workOrder);
    })
  );

  app.delete(
    "/api/work-orders/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete work order", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      await workOrderService.deleteWorkOrder(
        id,
        orgId,
        authenticatedRequest(req).user?.id
      );
      sendDeleted(res);
    })
  );
}
