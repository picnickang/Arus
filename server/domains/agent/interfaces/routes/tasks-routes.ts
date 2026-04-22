import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import type { AgentTaskService } from "../../application/task-service";
import { TASK_STATUSES, TASK_PRIORITIES, TASK_SOURCES } from "../../domain/task-types";
import type { AgentTaskFilter } from "../../domain/task-types";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface TasksRouteDeps {
  taskService: AgentTaskService;
  rateLimit: RateLimitMiddleware;
  requireMaintenanceRole: RoleMiddleware;
}

const taskCreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  source: z.enum(["suggestion", "signal", "user", "scheduled"]).optional(),
  parentTaskId: z.string().optional().nullable(),
  equipmentId: z.string().optional().nullable(),
  vesselId: z.string().optional().nullable(),
  predictionId: z.string().optional().nullable(),
  conversationId: z.string().optional().nullable(),
});

export function registerTasksRoutes(app: Express, deps: TasksRouteDeps) {
  const { taskService, rateLimit, requireMaintenanceRole } = deps;

  app.get(
    "/api/agent/tasks",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const filter: AgentTaskFilter = {};
        const qStatus = req.query.status as string | undefined;
        if (qStatus && (TASK_STATUSES as readonly string[]).includes(qStatus)) {
          filter.status = qStatus as AgentTaskFilter["status"];
        }
        const qPriority = req.query.priority as string | undefined;
        if (qPriority && (TASK_PRIORITIES as readonly string[]).includes(qPriority)) {
          filter.priority = qPriority as AgentTaskFilter["priority"];
        }
        const qSource = req.query.source as string | undefined;
        if (qSource && (TASK_SOURCES as readonly string[]).includes(qSource)) {
          filter.source = qSource as AgentTaskFilter["source"];
        }
        if (req.query.equipmentId) {
          filter.equipmentId = req.query.equipmentId as string;
        }
        if (req.query.vesselId) {
          filter.vesselId = req.query.vesselId as string;
        }
        filter.limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        filter.offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
        const tasks = await taskService.list(orgId, filter);
        res.json(tasks);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/tasks",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const parsed = taskCreateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid task data", details: parsed.error.flatten().fieldErrors });
        }
        const task = await taskService.create({ ...parsed.data, orgId });
        res.status(201).json(task);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/tasks/summary/counts",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const counts = await taskService.countByStatus(orgId);
        res.json(counts);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/tasks/:id",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const task = await taskService.getById(req.params.id, orgId);
        if (!task) {
          return res.status(404).json({ error: "Task not found" });
        }
        res.json(task);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.patch(
    "/api/agent/tasks/:id",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { status, outcome, title, description, priority } = req.body;
        if (status && TASK_STATUSES.includes(status)) {
          const task = await taskService.updateStatus(req.params.id, orgId, status, outcome);
          return res.json(task);
        }
        const updateData: Record<string, unknown> = {};
        if (title) {
          updateData.title = title;
        }
        if (description !== undefined) {
          updateData.description = description;
        }
        if (priority && TASK_PRIORITIES.includes(priority)) {
          updateData.priority = priority;
        }
        if (outcome) {
          updateData.outcome = outcome;
        }
        const task = await taskService.update(req.params.id, orgId, updateData);
        res.json(task);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        const statusCode = msg.includes("not found")
          ? 404
          : msg.includes("Cannot transition")
            ? 400
            : 500;
        res.status(statusCode).json({ error: msg });
      }
    }
  );
}
