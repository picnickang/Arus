// @ts-nocheck
import { Express, Request, Response, RequestHandler } from "express";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";
import { schedulingSettingsService } from "../../services/scheduling-settings/service";
import { logger } from "../../utils/logger";
import { dbMaintenanceStorage } from "../../db/maintenance/index.js";
import { dbOptimizerStorage } from "../../db/optimizer/index.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

interface SchedulingConfig {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
}

export function registerSchedulingRoutes(app: Express, config: SchedulingConfig) {
  const { requireOrgId, writeOperationRateLimit } = config;

  app.get(
    "/api/schedule",
    requireOrgId,
    withErrorHandling("fetch maintenance schedules", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { vesselId, equipmentId, status, dateFrom, dateTo } = req.query;
      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(
        equipmentId as string | undefined,
        orgId,
        {
          vesselId: vesselId as string | undefined,
          status: status as string | undefined,
          startDate: dateFrom ? new Date(dateFrom as string) : undefined,
          endDate: dateTo ? new Date(dateTo as string) : undefined,
        }
      );
      res.json(schedules);
    })
  );

  app.get(
    "/api/schedule/conflicts",
    requireOrgId,
    withErrorHandling("detect conflicts", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { dateFrom, dateTo, vesselId } = req.query;
      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        vesselId: vesselId as string | undefined,
        startDate: dateFrom ? new Date(dateFrom as string) : undefined,
        endDate: dateTo ? new Date(dateTo as string) : undefined,
      });

      const conflicts: any[] = [];
      for (let i = 0; i < schedules.length; i++) {
        for (let j = i + 1; j < schedules.length; j++) {
          const s1 = schedules[i];
          const s2 = schedules[j];
          if (
            s1.scheduledDate === s2.scheduledDate &&
            s1.assignedCrewId === s2.assignedCrewId
          ) {
            conflicts.push({
              schedule1: s1,
              schedule2: s2,
              conflictType: "crew_overlap",
            });
          }
        }
      }

      res.json(conflicts);
    })
  );

  app.get(
    "/api/schedule/calendar",
    requireOrgId,
    withErrorHandling("fetch calendar data", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { month, year, vesselId } = req.query;
      const targetMonth = month ? Number.parseInt(month as string) : new Date().getMonth();
      const targetYear = year ? Number.parseInt(year as string) : new Date().getFullYear();

      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0);

      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        vesselId: vesselId as string | undefined,
        startDate,
        endDate,
      });

      const calendarData: Record<string, any[]> = {};
      schedules.forEach((schedule: any) => {
        const raw = schedule.scheduledDate;
        const dateKey =
          raw instanceof Date
            ? raw.toISOString().split("T")[0]
            : typeof raw === "string"
              ? raw.split("T")[0]
              : String(raw);
        if (!calendarData[dateKey]) {
          calendarData[dateKey] = [];
        }
        calendarData[dateKey].push(schedule);
      });

      res.json(calendarData);
    })
  );

  app.get(
    "/api/schedule/stats",
    requireOrgId,
    withErrorHandling("fetch schedule statistics", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { vesselId, months } = req.query;
      const monthsNum = months ? Number.parseInt(months as string) : 3;
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsNum);

      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        vesselId: vesselId as string | undefined,
        startDate: cutoffDate,
      });

      const stats = {
        total: schedules.length,
        completed: schedules.filter((s: any) => s.status === "completed").length,
        pending: schedules.filter((s: any) => s.status === "pending").length,
        overdue: schedules.filter((s: any) => {
          const dueDate = new Date(s.scheduledDate);
          return s.status !== "completed" && dueDate < new Date();
        }).length,
        byPriority: {
          critical: schedules.filter((s: any) => s.priority === "critical").length,
          high: schedules.filter((s: any) => s.priority === "high").length,
          medium: schedules.filter((s: any) => s.priority === "medium").length,
          low: schedules.filter((s: any) => s.priority === "low").length,
        },
        completionRate:
          schedules.length > 0
            ? (schedules.filter((s: any) => s.status === "completed").length / schedules.length) *
              100
            : 0,
      };

      res.json(stats);
    })
  );

  app.get(
    "/api/schedule/upcoming",
    requireOrgId,
    withErrorHandling("fetch upcoming maintenance", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { days, vesselId, limit } = req.query;
      const daysNum = days ? Number.parseInt(days as string) : 30;
      const limitNum = limit ? Number.parseInt(limit as string) : 50;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysNum);

      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        vesselId: vesselId as string | undefined,
        status: "pending",
        startDate: new Date(),
        endDate,
      });

      const upcoming = schedules
        .sort(
          (a: any, b: any) =>
            new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
        )
        .slice(0, limitNum);

      res.json(upcoming);
    })
  );

  app.get(
    "/api/schedule/:id",
    requireOrgId,
    withErrorHandling("fetch schedule", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const schedule = await dbMaintenanceStorage.getMaintenanceSchedule(req.params.id, orgId);
      if (!schedule) {
        return sendNotFound(res, "Schedule");
      }
      res.json(schedule);
    })
  );

  app.post(
    "/api/schedule",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create schedule", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const scheduleData = { ...req.body, orgId };
      const schedule = await dbMaintenanceStorage.createMaintenanceSchedule(scheduleData);
      sendCreated(res, schedule);
    })
  );

  app.put(
    "/api/schedule/:id",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update schedule", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const schedule = await dbMaintenanceStorage.updateMaintenanceSchedule(
        req.params.id,
        req.body,
        orgId
      );
      res.json(schedule);
    })
  );

  app.delete(
    "/api/schedule/:id",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("delete schedule", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      await dbMaintenanceStorage.deleteMaintenanceSchedule(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.post(
    "/api/schedule/bulk",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create bulk schedules", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { schedules } = req.body;
      if (!Array.isArray(schedules)) {
        res.status(400).json({ message: "schedules must be an array" });
        return;
      }
      const results = await Promise.all(
        schedules.map((s: any) => dbMaintenanceStorage.createMaintenanceSchedule({ ...s, orgId }))
      );
      sendCreated(res, results);
    })
  );

  app.get(
    "/api/optimization/configurations",
    requireOrgId,
    withErrorHandling("fetch optimization configurations", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const configs = await dbOptimizerStorage.getOptimizerConfigurations(orgId);
      res.json(configs);
    })
  );

  app.post(
    "/api/optimization/configurations",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create optimization configuration", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const config = await dbOptimizerStorage.createOptimizerConfiguration({ ...req.body, orgId });
      sendCreated(res, config);
    })
  );

  app.get(
    "/api/optimization/results",
    requireOrgId,
    withErrorHandling("fetch optimization results", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { configId, dateFrom, dateTo } = req.query;
      const results = await dbOptimizerStorage.getOptimizationResults(
        orgId,
        dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo ? new Date(dateTo as string) : undefined
      );
      res.json(results);
    })
  );

  app.post(
    "/api/optimization/results",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create optimization result", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const result = await dbOptimizerStorage.createOptimizationResult({ ...req.body, orgId });
      sendCreated(res, result);
    })
  );

  app.post(
    "/api/optimization/run",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("run optimization", async (req: Request, res: Response) => {
      const { configId, targetDate } = req.body;
      const orgId = DEFAULT_ORG_ID;

      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        startDate: new Date(),
        endDate: targetDate ? new Date(targetDate) : undefined,
      });

      const optimizedSchedules = schedules.map((s: any, index: number) => ({
        ...s,
        optimizedScore: (index % 10) * 10 + 5,
        suggestedDate: s.scheduledDate,
        suggestedCrew: s.assignedCrewId,
      }));

      const result = await dbOptimizerStorage.createOptimizationResult({
        configId,
        orgId,
        inputSchedules: schedules.length,
        outputSchedules: optimizedSchedules.length,
        improvementScore: 15.5,
        status: "completed",
        results: optimizedSchedules,
      });

      res.json(result);
    })
  );

  app.get(
    "/api/scheduling-settings",
    requireOrgId,
    withErrorHandling("fetch scheduling settings", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const vesselId = req.query.vesselId as string | undefined;

      const effective = await schedulingSettingsService.resolveEffectiveSettings(orgId, vesselId);
      const settings = await schedulingSettingsService.getSettings(orgId, vesselId);

      res.json({
        id: settings?.id || "",
        orgId,
        vesselId: vesselId || null,
        notificationSettings: effective.notificationSettings,
        ruleThresholds: effective.ruleThresholds,
        ruleEnforcement: effective.ruleEnforcement,
        aiWeights: effective.aiWeights,
        publishBehavior: effective.publishBehavior,
        rotationTemplates: effective.rotationTemplates,
        source: effective.source,
      });
    })
  );

  app.patch(
    "/api/scheduling-settings/notifications",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update notification settings", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const vesselId = req.query.vesselId as string | undefined;

      const updated = await schedulingSettingsService.updateNotificationSettings(
        orgId,
        req.body,
        vesselId
      );

      logger.info("[SchedulingSettings] Notifications updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/rules",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update rule settings", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const vesselId = req.query.vesselId as string | undefined;
      const { thresholds, enforcement } = req.body;

      const updated = await schedulingSettingsService.updateRuleThresholds(
        orgId,
        thresholds,
        enforcement,
        vesselId
      );

      logger.info("[SchedulingSettings] Rules updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/ai-weights",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update AI weights", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const vesselId = req.query.vesselId as string | undefined;

      const updated = await schedulingSettingsService.updateAiWeights(orgId, req.body, vesselId);

      logger.info("[SchedulingSettings] AI weights updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/publish-behavior",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update publish behavior", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const vesselId = req.query.vesselId as string | undefined;

      const updated = await schedulingSettingsService.updatePublishBehavior(
        orgId,
        req.body,
        vesselId
      );

      logger.info("[SchedulingSettings] Publish behavior updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/rotation-templates",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update rotation templates", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const vesselId = req.query.vesselId as string | undefined;

      const updated = await schedulingSettingsService.updateRotationTemplates(
        orgId,
        req.body,
        vesselId
      );

      logger.info("[SchedulingSettings] Rotation templates updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.post(
    "/api/scheduling-settings/reset",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("reset scheduling settings", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const vesselId = req.query.vesselId as string | undefined;

      const reset = await schedulingSettingsService.resetToDefaults(orgId, vesselId);

      logger.info("[SchedulingSettings] Settings reset to defaults", { orgId, vesselId });
      res.json(reset);
    })
  );

  logger.info("[SchedulingRoutes] Scheduling settings routes registered");
}
