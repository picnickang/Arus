/**
 * Work Order Tasks Routes
 *
 * Ad-hoc task management for work orders: GET, POST, PATCH, DELETE.
 */

import type { Express, Request, Response } from "express";
import { workOrderAppService as workOrderService } from "../application";
import { requireOrgId, AuthenticatedRequest } from "../../../middleware/auth";
import { createTaskSchema, updateTaskSchema } from "./schemas";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils";
import { validateBody, sendValidationError } from "../../../lib/api-helpers";
import type { RateLimitMiddleware } from "./types";

export function registerTasksRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const { writeOperationRateLimit } = rateLimit;

  app.get(
    "/api/work-orders/:id/tasks",
    requireOrgId,
    withErrorHandling("fetch work order tasks", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const tasks = await workOrderService.getWorkOrderTasks(req.params['id'] ?? '', orgId);
      res.json(tasks);
    })
  );

  app.post(
    "/api/work-orders/:id/tasks",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create work order task", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const workOrderId = req.params['id'] ?? '';

      const validation = validateBody(req, createTaskSchema);
      if (!validation.success) {
        return sendValidationError(res, validation.error, "Invalid task data");
      }

      const workOrder = await workOrderService.getWorkOrderById(workOrderId, orgId);
      if (!workOrder) {
        return sendNotFound(res, "Work order");
      }

      const taskData = {
        orgId,
        workOrderId,
        description: validation.data.description,
        isCompleted: validation.data.isCompleted,
        sortOrder: validation.data.sortOrder,
      };

      const task = await workOrderService.createWorkOrderTask(taskData);
      sendCreated(res, task);
    })
  );

  app.patch(
    "/api/work-orders/:id/tasks/:taskId",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update work order task", async (req: Request, res: Response) => {
      const { taskId = '' } = req.params;

      const validation = validateBody(req, updateTaskSchema);
      if (!validation.success) {
        return sendValidationError(res, validation.error, "Invalid update data");
      }

      const validatedData = validation.data;
      const updateData: Parameters<typeof workOrderService.updateWorkOrderTask>[1] = {};

      if (validatedData.description !== undefined) {
        updateData.description = validatedData.description;
      }
      if (validatedData.isCompleted !== undefined) {
        updateData.isCompleted = validatedData.isCompleted;
        if (validatedData.isCompleted) {
          updateData.completedAt = new Date();
          updateData.completedBy = validatedData.completedBy || "current-user";
          updateData.completedByName = validatedData.completedByName || "Current User";
        } else {
          updateData.completedAt = null;
          updateData.completedBy = null;
          updateData.completedByName = null;
        }
      }

      if (validatedData.sortOrder !== undefined) {
        updateData.sortOrder = validatedData.sortOrder;
      }

      const task = await workOrderService.updateWorkOrderTask(taskId, updateData);
      res.json(task);
    })
  );

  app.delete(
    "/api/work-orders/:id/tasks/:taskId",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("delete work order task", async (req: Request, res: Response) => {
      const { taskId = '' } = req.params;
      await workOrderService.deleteWorkOrderTask(taskId);
      sendDeleted(res);
    })
  );
}
