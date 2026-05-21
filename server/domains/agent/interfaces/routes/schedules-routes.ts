import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { agentRepo } from "../../infrastructure/repository";
import type { SchedulerService } from "../../application/scheduler-service";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

const idParamSchema = z.object({ id: z.string().min(1) });
const scheduleBodySchema = z.record(z.unknown());

export interface SchedulesRouteDeps {
  globalScheduler: SchedulerService;
  rateLimit: RateLimitMiddleware;
  requireAdminRole: RoleMiddleware;
}

export function registerSchedulesRoutes(app: Express, deps: SchedulesRouteDeps) {
  const { globalScheduler, rateLimit, requireAdminRole } = deps;

  app.get(
    "/api/agent/schedules",
    rateLimit.generalApiRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const schedules = await agentRepo.schedules.list(orgId);
        res.json(schedules);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/schedules",
    rateLimit.writeOperationRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const body = scheduleBodySchema.parse(req.body ?? {});
        const schedule = await agentRepo.schedules.create({
          ...body,
          orgId,
        } as Parameters<typeof agentRepo.schedules.create>[0]);
        if (schedule.enabled) {
          globalScheduler.scheduleJob(schedule);
        }
        res.status(201).json(schedule);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.put(
    "/api/agent/schedules/:id",
    rateLimit.writeOperationRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { id } = idParamSchema.parse(req.params);
        const existing = await agentRepo.schedules.get(id, orgId);
        if (!existing) {
          return res.status(404).json({ error: "Schedule not found" });
        }
        const body = scheduleBodySchema.parse(req.body ?? {});
        const schedule = await agentRepo.schedules.update(
          id,
          body as Parameters<typeof agentRepo.schedules.update>[1]
        );
        if (schedule.enabled) {
          globalScheduler.scheduleJob(schedule);
        } else {
          globalScheduler.cancelJob(schedule.id);
        }
        res.json(schedule);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.delete(
    "/api/agent/schedules/:id",
    rateLimit.writeOperationRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { id } = idParamSchema.parse(req.params);
        const existing = await agentRepo.schedules.get(id, orgId);
        if (!existing) {
          return res.status(404).json({ error: "Schedule not found" });
        }
        globalScheduler.cancelJob(id);
        await agentRepo.schedules.delete(id);
        res.json({ success: true });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/schedules/:id/runs",
    rateLimit.generalApiRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { id } = idParamSchema.parse(req.params);
        const existing = await agentRepo.schedules.get(id, orgId);
        if (!existing) {
          return res.status(404).json({ error: "Schedule not found" });
        }
        const runs = await agentRepo.schedules.getRuns(id);
        res.json(runs);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/schedules/:id/run",
    rateLimit.writeOperationRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { id } = idParamSchema.parse(req.params);
        const schedule = await agentRepo.schedules.get(id, orgId);
        if (!schedule) {
          return res.status(404).json({ error: "Schedule not found" });
        }

        await globalScheduler.executeSchedule(schedule);
        res.json({ success: true, message: "Schedule run triggered" });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
