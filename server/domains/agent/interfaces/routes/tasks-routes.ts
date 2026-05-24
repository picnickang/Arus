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

const tasksListQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  source: z.string().optional(),
  equipmentId: z.string().optional(),
  vesselId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const taskIdParamSchema = z.object({ id: z.string().min(1) });

const taskUpdateSchema = z.object({
  status: z.string().optional(),
  outcome: z.unknown().optional(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  priority: z.string().optional(),
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
        const q = tasksListQuerySchema.parse(req.query);
        const filter: AgentTaskFilter = {};
        if (q.status && (TASK_STATUSES as readonly string[]).includes(q.status)) {
          filter.status = q.status as AgentTaskFilter["status"];
        }
        if (q.priority && (TASK_PRIORITIES as readonly string[]).includes(q.priority)) {
          filter.priority = q.priority as AgentTaskFilter["priority"];
        }
        if (q.source && (TASK_SOURCES as readonly string[]).includes(q.source)) {
          filter.source = q.source as AgentTaskFilter["source"];
        }
        if (q.equipmentId) filter.equipmentId = q.equipmentId;
        if (q.vesselId) filter.vesselId = q.vesselId;
        filter.limit = Math.min(q.limit ?? 50, 200);
        filter.offset = Math.max(q.offset ?? 0, 0);
        const tasks = await taskService.list(orgId, filter);
        return res.json(tasks);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        return res.status(201).json(task);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        return res.json(counts);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        const { id } = taskIdParamSchema.parse(req.params);
        const task = await taskService.getById(id, orgId);
        if (!task) {
          return res.status(404).json({ error: "Task not found" });
        }
        return res.json(task);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        const { id } = taskIdParamSchema.parse(req.params);
        const { status, outcome, title, description, priority } = taskUpdateSchema.parse(req.body);
        if (status && (TASK_STATUSES as readonly string[]).includes(status)) {
          const task = await taskService.updateStatus(
            id,
            orgId,
            status as AgentTaskFilter["status"] & string,
            outcome as Parameters<typeof taskService.updateStatus>[3]
          );
          return res.json(task);
        }
        const updateData: Record<string, unknown> = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (priority && (TASK_PRIORITIES as readonly string[]).includes(priority)) {
          updateData.priority = priority;
        }
        if (outcome !== undefined) updateData.outcome = outcome;
        const task = await taskService.update(id, orgId, updateData);
        return res.json(task);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        const statusCode = msg.includes("not found")
          ? 404
          : msg.includes("Cannot transition")
            ? 400
            : 500;
        return res.status(statusCode).json({ error: msg });
      }
    }
  );
}
