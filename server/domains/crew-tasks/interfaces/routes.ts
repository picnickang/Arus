/**
 * Crew Task Routes (Interfaces Layer)
 * HTTP concerns for the crew-tasks domain.
 *
 * Authorization: org-scoped reads gate on `crew_members:view`; writes gate
 * on `crew_members:create` (POST) / `crew_members:edit` (PATCH) /
 * `crew_members:delete` (DELETE) — matching the Crew Management surface
 * these tasks live inside, NOT hardcoded role names.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { crewTaskService } from "../service";
import { authenticatedRequest, requireOrgId } from "../../../middleware/auth";
import { requirePermission } from "../../../lib/permissions/middleware.js";
import {
  withErrorHandling,
  sendCreated,
  sendDeleted,
  sendNotFound,
} from "../../../lib/route-utils";
import {
  CREW_TASK_STATUSES,
  CREW_TASK_PRIORITIES,
  CREW_TASK_LINKED_SOURCE_TYPES,
} from "@shared/schema-runtime";
import type { CrewTaskActor } from "../domain/types";

const statusEnum = z.enum(CREW_TASK_STATUSES as readonly [string, ...string[]]);
const priorityEnum = z.enum(CREW_TASK_PRIORITIES as readonly [string, ...string[]]);

const linkedSourceTypeEnum = z.enum(
  CREW_TASK_LINKED_SOURCE_TYPES as readonly [string, ...string[]]
);

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  vesselId: z.string().min(1).optional(),
  assignedCrewId: z.string().min(1).optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().optional(),
  blockedReason: z.string().optional(),
  assignedTo: z.string().optional(),
  linkedSourceType: linkedSourceTypeEnum.optional(),
  linkedSourceId: z.string().min(1).optional(),
  linkedSourceLabel: z.string().optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    vesselId: z.string().min(1).nullable().optional(),
    assignedCrewId: z.string().min(1).nullable().optional(),
    status: statusEnum.optional(),
    priority: priorityEnum.optional(),
    dueDate: z.string().nullable().optional(),
    blockedReason: z.string().nullable().optional(),
    assignedTo: z.string().nullable().optional(),
    linkedSourceType: linkedSourceTypeEnum.nullable().optional(),
    linkedSourceId: z.string().min(1).nullable().optional(),
    linkedSourceLabel: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const addCommentSchema = z.object({
  message: z.string().min(1).max(5000),
});

function actorFrom(req: Request): CrewTaskActor {
  const user = authenticatedRequest(req).user;
  return {
    id: user?.id,
    name: user?.name,
    role: user?.role,
  };
}

export function registerCrewTaskRoutes(
  app: Express,
  rateLimit: {
    generalApiRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    writeOperationRateLimit?: import("../../../lib/rate-limit-factory").RateLimit;
  }
) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimit;
  const writeLimit = writeOperationRateLimit || generalApiRateLimit;

  app.get(
    "/api/crew-tasks",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("list crew tasks", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { vesselId, assignedCrewId, status, includeDone } = z
        .object({
          vesselId: z.string().optional(),
          assignedCrewId: z.string().optional(),
          status: statusEnum.optional(),
          includeDone: z
            .enum(["true", "false"])
            .optional()
            .transform((value) => value === "true"),
        })
        .parse(req.query);

      const tasks = await crewTaskService.listTasks(orgId, {
        includeDone,
        ...(vesselId !== undefined && { vesselId }),
        ...(assignedCrewId !== undefined && { assignedCrewId }),
        ...(status !== undefined && { status }),
      });
      return res.json(tasks);
    })
  );

  app.get(
    "/api/crew-tasks/:id",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("get crew task", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const task = await crewTaskService.getTask(orgId, req.params["id"] ?? "");
      if (!task) {
        return sendNotFound(res, "Crew task");
      }
      return res.json(task);
    })
  );

  app.post(
    "/api/crew-tasks",
    requireOrgId,
    requirePermission("crew_members", "create"),
    writeLimit,
    withErrorHandling("create crew task", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const data = createTaskSchema.parse(req.body);
      const task = await crewTaskService.createTask(
        {
          ...data,
          orgId,
          createdBy: authenticatedRequest(req).user?.id,
        },
        actorFrom(req)
      );
      return sendCreated(res, task);
    })
  );

  app.patch(
    "/api/crew-tasks/:id",
    requireOrgId,
    requirePermission("crew_members", "edit"),
    writeLimit,
    withErrorHandling("update crew task", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const patch = updateTaskSchema.parse(req.body);
      const task = await crewTaskService.updateTask(
        orgId,
        req.params["id"] ?? "",
        patch,
        actorFrom(req)
      );
      if (!task) {
        return sendNotFound(res, "Crew task");
      }
      return res.json(task);
    })
  );

  app.delete(
    "/api/crew-tasks/:id",
    requireOrgId,
    requirePermission("crew_members", "delete"),
    writeLimit,
    withErrorHandling("delete crew task", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const deleted = await crewTaskService.deleteTask(
        orgId,
        req.params["id"] ?? "",
        actorFrom(req)
      );
      if (!deleted) {
        return sendNotFound(res, "Crew task");
      }
      return sendDeleted(res);
    })
  );

  app.get(
    "/api/crew-tasks/:id/events",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("list crew task events", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const task = await crewTaskService.getTask(orgId, req.params["id"] ?? "");
      if (!task) {
        return sendNotFound(res, "Crew task");
      }
      const events = await crewTaskService.listEvents(orgId, req.params["id"] ?? "");
      return res.json(events);
    })
  );

  app.post(
    "/api/crew-tasks/:id/comments",
    requireOrgId,
    requirePermission("crew_members", "edit"),
    writeLimit,
    withErrorHandling("add crew task comment", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { message } = addCommentSchema.parse(req.body);
      const event = await crewTaskService.addComment(
        orgId,
        req.params["id"] ?? "",
        message,
        actorFrom(req)
      );
      if (!event) {
        return sendNotFound(res, "Crew task");
      }
      return sendCreated(res, event);
    })
  );
}
