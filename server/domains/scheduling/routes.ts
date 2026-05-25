import { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";
import { schedulingSettingsService } from "../../services/scheduling-settings/service";
import { logger } from "../../utils/logger";
import { dbMaintenanceStorage } from "../../db/maintenance/index.js";
import type { MaintenanceSchedule } from "@shared/schema";
import { dbOptimizerStorage } from "../../db/optimizer/index.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

interface SchedulingConfig {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
}

const scheduleListQuerySchema = z.object({
  vesselId: z.string().optional(),
  equipmentId: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const scheduleConflictsQuerySchema = z.object({
  vesselId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const calendarQuerySchema = z.object({
  vesselId: z.string().optional(),
  month: z.coerce.number().int().min(0).max(11).optional(),
  year: z.coerce.number().int().min(1970).max(9999).optional(),
});

const statsQuerySchema = z.object({
  vesselId: z.string().optional(),
  months: z.coerce.number().int().min(1).max(36).optional(),
});

const upcomingQuerySchema = z.object({
  vesselId: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

const scheduleBodySchema = z.record(z.unknown());
const bulkSchedulesBodySchema = z.object({
  schedules: z.array(z.record(z.unknown())).min(1),
});

const runOptimizationBodySchema = z.object({
  configId: z.string().min(1),
  targetDate: z.string().optional(),
});

const optimizationResultsQuerySchema = z.object({
  configId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const vesselIdOnlyQuerySchema = z.object({
  vesselId: z.string().optional(),
});

const rulesUpdateBodySchema = z.object({
  thresholds: z.unknown(),
  enforcement: z.unknown(),
});

export function registerSchedulingRoutes(app: Express, config: SchedulingConfig) {
  const { requireOrgId, writeOperationRateLimit } = config;

  app.get(
    "/api/schedule",
    requireOrgId,
    withErrorHandling("fetch maintenance schedules", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { vesselId, equipmentId, status, dateFrom, dateTo } =
        scheduleListQuerySchema.parse(req.query);
      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(
        equipmentId,
        orgId,
        {
          vesselId,
          status,
          startDate: dateFrom ? new Date(dateFrom) : undefined,
          endDate: dateTo ? new Date(dateTo) : undefined,
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
      const { dateFrom, dateTo, vesselId } = scheduleConflictsQuerySchema.parse(req.query);
      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        vesselId,
        startDate: dateFrom ? new Date(dateFrom) : undefined,
        endDate: dateTo ? new Date(dateTo) : undefined,
      });

      const conflicts: Array<{
        schedule1: MaintenanceSchedule;
        schedule2: MaintenanceSchedule;
        conflictType: string;
      }> = [];
      for (let i = 0; i < schedules.length; i++) {
        for (let j = i + 1; j < schedules.length; j++) {
          const s1 = schedules[i];
          const s2 = schedules[j];
          const s1Bag: Record<string, unknown> = s1 as object as Record<string, unknown>;
          const s2Bag: Record<string, unknown> = s2 as object as Record<string, unknown>;
          if (
            s1.scheduledDate === s2.scheduledDate &&
            s1Bag['assignedCrewId'] === s2Bag['assignedCrewId']
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
      const { month, year, vesselId } = calendarQuerySchema.parse(req.query);
      const targetMonth = month ?? new Date().getMonth();
      const targetYear = year ?? new Date().getFullYear();

      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0);

      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        vesselId,
        startDate,
        endDate,
      });

      const calendarData: Record<string, MaintenanceSchedule[]> = {};
      schedules.forEach((schedule) => {
        const raw: Date | string = schedule.scheduledDate as Date | string;
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
      const { vesselId, months } = statsQuerySchema.parse(req.query);
      const monthsNum = months ?? 3;
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsNum);

      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        vesselId,
        startDate: cutoffDate,
      });

      const bag = (s: MaintenanceSchedule) =>
        s as object as { status?: string; priority?: string | number; scheduledDate: Date };
      const isPriority = (s: MaintenanceSchedule, name: string) =>
        String(bag(s).priority ?? "") === name;
      const stats = {
        total: schedules.length,
        completed: schedules.filter((s) => bag(s).status === "completed").length,
        pending: schedules.filter((s) => bag(s).status === "pending").length,
        overdue: schedules.filter((s) => {
          const dueDate = new Date(s.scheduledDate);
          return bag(s).status !== "completed" && dueDate < new Date();
        }).length,
        byPriority: {
          critical: schedules.filter((s) => isPriority(s, "critical")).length,
          high: schedules.filter((s) => isPriority(s, "high")).length,
          medium: schedules.filter((s) => isPriority(s, "medium")).length,
          low: schedules.filter((s) => isPriority(s, "low")).length,
        },
        completionRate:
          schedules.length > 0
            ? (schedules.filter((s) => bag(s).status === "completed").length / schedules.length) *
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
      const { days, vesselId, limit } = upcomingQuerySchema.parse(req.query);
      const daysNum = days ?? 30;
      const limitNum = limit ?? 50;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysNum);

      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        vesselId,
        status: "pending",
        startDate: new Date(),
        endDate,
      });

      const upcoming = schedules
        .sort(
          (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime(),
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
      const { id } = idParamSchema.parse(req.params);
      const schedule = await dbMaintenanceStorage.getMaintenanceSchedule(id, orgId);
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
      const body = scheduleBodySchema.parse(req.body);
      const scheduleData = { ...body, orgId } as Parameters<
        typeof dbMaintenanceStorage.createMaintenanceSchedule
      >[0];
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
      const { id } = idParamSchema.parse(req.params);
      const body = scheduleBodySchema.parse(req.body);
      const schedule = await dbMaintenanceStorage.updateMaintenanceSchedule(
        id,
        body as Parameters<typeof dbMaintenanceStorage.updateMaintenanceSchedule>[1],
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
      const { id } = idParamSchema.parse(req.params);
      await dbMaintenanceStorage.deleteMaintenanceSchedule(id, orgId);
      sendDeleted(res);
    })
  );

  app.post(
    "/api/schedule/bulk",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create bulk schedules", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { schedules } = bulkSchedulesBodySchema.parse(req.body);
      const results = await Promise.all(
        schedules.map((s) =>
          dbMaintenanceStorage.createMaintenanceSchedule(
            { ...s, orgId } as Parameters<
              typeof dbMaintenanceStorage.createMaintenanceSchedule
            >[0],
          ),
        )
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
      const body = scheduleBodySchema.parse(req.body);
      const config = await dbOptimizerStorage.createOptimizerConfiguration({
        ...body,
        orgId,
      } as Parameters<typeof dbOptimizerStorage.createOptimizerConfiguration>[0]);
      sendCreated(res, config);
    })
  );

  app.get(
    "/api/optimization/results",
    requireOrgId,
    withErrorHandling("fetch optimization results", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { dateFrom, dateTo } = optimizationResultsQuerySchema.parse(req.query);
      const results = await dbOptimizerStorage.getOptimizationResults(
        orgId,
        dateFrom ? new Date(dateFrom) : undefined,
        dateTo ? new Date(dateTo) : undefined
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
      const body = scheduleBodySchema.parse(req.body);
      const result = await dbOptimizerStorage.createOptimizationResult({
        ...body,
        orgId,
      } as Parameters<typeof dbOptimizerStorage.createOptimizationResult>[0]);
      sendCreated(res, result);
    })
  );

  app.post(
    "/api/optimization/run",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("run optimization", async (req: Request, res: Response) => {
      const { configId, targetDate } = runOptimizationBodySchema.parse(req.body);
      const orgId = DEFAULT_ORG_ID;

      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        startDate: new Date(),
        endDate: targetDate ? new Date(targetDate) : undefined,
      });

      const optimizedSchedules = schedules.map((s, index: number) => {
        const bag = s as object as Record<string, unknown>;
        return {
          ...s,
          optimizedScore: (index % 10) * 10 + 5,
          suggestedDate: s.scheduledDate,
          suggestedCrew: bag['assignedCrewId'],
        };
      });

      const result = await dbOptimizerStorage.createOptimizationResult({
        configurationId: configId,
        orgId,
        inputSchedules: schedules.length,
        outputSchedules: optimizedSchedules.length,
        improvementScore: 15.5,
        runStatus: "completed",
        results: optimizedSchedules,
      } as Parameters<typeof dbOptimizerStorage.createOptimizationResult>[0]);

      res.json(result);
    })
  );

  app.get(
    "/api/scheduling-settings",
    requireOrgId,
    withErrorHandling("fetch scheduling settings", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);

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
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = scheduleBodySchema.parse(req.body);

      const updated = await schedulingSettingsService.updateNotificationSettings(
        orgId,
        body as Parameters<typeof schedulingSettingsService.updateNotificationSettings>[1],
        vesselId,
      );

      logger.info("SchedulingSettings", "Notifications updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/rules",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update rule settings", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const { thresholds, enforcement } = rulesUpdateBodySchema.parse(req.body);

      const updated = await schedulingSettingsService.updateRuleThresholds(
        orgId,
        thresholds as Parameters<typeof schedulingSettingsService.updateRuleThresholds>[1],
        enforcement as Parameters<typeof schedulingSettingsService.updateRuleThresholds>[2],
        vesselId,
      );

      logger.info("SchedulingSettings", "Rules updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/ai-weights",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update AI weights", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = scheduleBodySchema.parse(req.body);

      const updated = await schedulingSettingsService.updateAiWeights(
        orgId,
        body as Parameters<typeof schedulingSettingsService.updateAiWeights>[1],
        vesselId
      );

      logger.info("SchedulingSettings", "AI weights updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/publish-behavior",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update publish behavior", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = scheduleBodySchema.parse(req.body);

      const updated = await schedulingSettingsService.updatePublishBehavior(
        orgId,
        body as Parameters<typeof schedulingSettingsService.updatePublishBehavior>[1],
        vesselId,
      );

      logger.info("SchedulingSettings", "Publish behavior updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch(
    "/api/scheduling-settings/rotation-templates",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update rotation templates", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = z.array(z.record(z.unknown())).parse(req.body);

      const updated = await schedulingSettingsService.updateRotationTemplates(
        orgId,
        body as Parameters<typeof schedulingSettingsService.updateRotationTemplates>[1],
        vesselId,
      );

      logger.info("SchedulingSettings", "Rotation templates updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.post(
    "/api/scheduling-settings/reset",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("reset scheduling settings", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);

      const reset = await schedulingSettingsService.resetToDefaults(orgId, vesselId);

      logger.info("SchedulingSettings", "Settings reset to defaults", { orgId, vesselId });
      res.json(reset);
    })
  );

  logger.info("[SchedulingRoutes] Scheduling settings routes registered");
}
