import type { Express, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { agentRepo } from "../../infrastructure/repository";
import type { SchedulerService } from "../../application/scheduler-service";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

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
        const schedule = await agentRepo.schedules.create({ ...req.body, orgId });
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
        const existing = await agentRepo.schedules.get(req.params.id, orgId);
        if (!existing) {
          return res.status(404).json({ error: "Schedule not found" });
        }
        const schedule = await agentRepo.schedules.update(req.params.id, req.body);
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
        const existing = await agentRepo.schedules.get(req.params.id, orgId);
        if (!existing) {
          return res.status(404).json({ error: "Schedule not found" });
        }
        globalScheduler.cancelJob(req.params.id);
        await agentRepo.schedules.delete(req.params.id);
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
        const existing = await agentRepo.schedules.get(req.params.id, orgId);
        if (!existing) {
          return res.status(404).json({ error: "Schedule not found" });
        }
        const runs = await agentRepo.schedules.getRuns(req.params.id);
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
        const schedule = await agentRepo.schedules.get(req.params.id, orgId);
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
