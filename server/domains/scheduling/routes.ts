import { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";
import { validateResponse } from "../../lib/api-helpers";
import { loadSections } from "../../lib/aggregate-helpers";
import { schedulingSettingsService } from "../../services/scheduling-settings/service";
import { logger } from "../../utils/logger";
import { dbMaintenanceStorage } from "../../db/maintenance/index.js";
import type { MaintenanceSchedule } from "@shared/schema";
import { dbOptimizerStorage } from "../../db/optimizer/index.js";
import { optimizationDirectory } from "../../composition/optimization-directory.js";
import { authenticatedRequest } from "../../middleware/auth";
import {
  aiWeightsSchema,
  notificationSettingsSchema,
  publishBehaviorSchema,
  rotationTemplateSchema,
  ruleEnforcementSettingsSchema,
  ruleThresholdsSchema,
} from "@shared/schema-runtime";

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

const scheduleBodySchema = jsonRecordSchema;
const bulkSchedulesBodySchema = z.object({
  schedules: z.array(jsonRecordSchema).min(1),
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

const aggregateSectionSchema = z.array(z.record(z.unknown()));
const optimizationDashboardResponseSchema = z.object({
  configurations: aggregateSectionSchema,
  results: aggregateSectionSchema,
  trendInsights: aggregateSectionSchema,
  equipment: aggregateSectionSchema,
  vessels: aggregateSectionSchema,
  sectionErrors: z.record(z.string()).optional(),
});

const vesselIdOnlyQuerySchema = z.object({
  vesselId: z.string().optional(),
});

const rulesUpdateBodySchema = z.object({
  thresholds: ruleThresholdsSchema,
  enforcement: ruleEnforcementSettingsSchema,
});

function orgIdFromRequest(req: Request): string {
  return authenticatedRequest(req).orgId;
}

function scheduleField(schedule: MaintenanceSchedule, field: string): unknown {
  return Reflect.get(schedule, field);
}

export function registerSchedulingRoutes(app: Express, config: SchedulingConfig) {
  const { requireOrgId, writeOperationRateLimit } = config;

  app.get(
    "/api/schedule",
    requireOrgId,
    withErrorHandling("fetch maintenance schedules", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
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
      const orgId = orgIdFromRequest(req);
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
          if (!s1 || !s2) {continue;}
          if (
            s1.scheduledDate === s2.scheduledDate &&
            scheduleField(s1, "assignedCrewId") === scheduleField(s2, "assignedCrewId")
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
      const orgId = orgIdFromRequest(req);
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
        const dateKey = new Date(schedule.scheduledDate).toISOString().split("T")[0] ?? "";
        if (!calendarData[dateKey]) {
          calendarData[dateKey] = [];
        }
        calendarData[dateKey]?.push(schedule);
      });

      res.json(calendarData);
    })
  );

  app.get(
    "/api/schedule/stats",
    requireOrgId,
    withErrorHandling("fetch schedule statistics", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { vesselId, months } = statsQuerySchema.parse(req.query);
      const monthsNum = months ?? 3;
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsNum);

      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        vesselId,
        startDate: cutoffDate,
      });

      const isPriority = (s: MaintenanceSchedule, name: string) =>
        String(scheduleField(s, "priority") ?? "") === name;
      const stats = {
        total: schedules.length,
        completed: schedules.filter((s) => scheduleField(s, "status") === "completed").length,
        pending: schedules.filter((s) => scheduleField(s, "status") === "pending").length,
        overdue: schedules.filter((s) => {
          const dueDate = new Date(s.scheduledDate);
          return scheduleField(s, "status") !== "completed" && dueDate < new Date();
        }).length,
        byPriority: {
          critical: schedules.filter((s) => isPriority(s, "critical")).length,
          high: schedules.filter((s) => isPriority(s, "high")).length,
          medium: schedules.filter((s) => isPriority(s, "medium")).length,
          low: schedules.filter((s) => isPriority(s, "low")).length,
        },
        completionRate:
          schedules.length > 0
            ? (schedules.filter((s) => scheduleField(s, "status") === "completed").length / schedules.length) *
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
      const orgId = orgIdFromRequest(req);
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
      const orgId = orgIdFromRequest(req);
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
      const orgId = orgIdFromRequest(req);
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
      const orgId = orgIdFromRequest(req);
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
      const orgId = orgIdFromRequest(req);
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
      const orgId = orgIdFromRequest(req);
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
    "/api/optimization/dashboard",
    requireOrgId,
    withErrorHandling("fetch optimization dashboard", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);

      // Aggregate for useOptimizationData: collapses the page's parallel
      // configurations/results/trend-insights/equipment/vessels fetches into
      // one request, reusing exactly the storage calls of the individual
      // routes above/below. trendInsights is reserved — the per-resource
      // endpoint never existed and the client always fell back to [].
      const { sections, sectionErrors } = await loadSections(
        {
          configurations: () => dbOptimizerStorage.getOptimizerConfigurations(orgId),
          results: () => dbOptimizerStorage.getOptimizationResults(orgId),
          equipment: () => optimizationDirectory.listEquipmentRegistry(orgId),
          vessels: () => optimizationDirectory.listVessels(orgId),
        },
        "GET /api/optimization/dashboard"
      );

      res.json(
        validateResponse(
          optimizationDashboardResponseSchema,
          {
            configurations: sections.configurations ?? [],
            results: sections.results ?? [],
            trendInsights: [],
            equipment: sections.equipment ?? [],
            vessels: sections.vessels ?? [],
            ...(Object.keys(sectionErrors).length > 0 ? { sectionErrors } : {}),
          },
          "GET /api/optimization/dashboard"
        )
      );
    })
  );

  app.get(
    "/api/optimization/configurations",
    requireOrgId,
    withErrorHandling("fetch optimization configurations", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const configs = await dbOptimizerStorage.getOptimizerConfigurations(orgId);
      res.json(configs);
    })
  );

  app.post(
    "/api/optimization/configurations",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create optimization configuration", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
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
      const orgId = orgIdFromRequest(req);
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
      const orgId = orgIdFromRequest(req);
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
      const orgId = orgIdFromRequest(req);

      const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
        startDate: new Date(),
        endDate: targetDate ? new Date(targetDate) : undefined,
      });

      const optimizedSchedules = schedules.map((s, index: number) => {
        return {
          ...s,
          optimizedScore: (index % 10) * 10 + 5,
          suggestedDate: s.scheduledDate,
          suggestedCrew: scheduleField(s, "assignedCrewId"),
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
      const orgId = orgIdFromRequest(req);
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
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = notificationSettingsSchema.parse(req.body);

      const updated = await schedulingSettingsService.updateNotificationSettings(
        orgId,
        body,
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
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const { thresholds, enforcement } = rulesUpdateBodySchema.parse(req.body);

      const updated = await schedulingSettingsService.updateRuleThresholds(
        orgId,
        thresholds,
        enforcement,
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
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = aiWeightsSchema.parse(req.body);

      const updated = await schedulingSettingsService.updateAiWeights(
        orgId,
        body,
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
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = publishBehaviorSchema.parse(req.body);

      const updated = await schedulingSettingsService.updatePublishBehavior(
        orgId,
        body,
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
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);
      const body = z.array(rotationTemplateSchema).parse(req.body);

      const updated = await schedulingSettingsService.updateRotationTemplates(
        orgId,
        body,
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
      const orgId = orgIdFromRequest(req);
      const { vesselId } = vesselIdOnlyQuerySchema.parse(req.query);

      const reset = await schedulingSettingsService.resetToDefaults(orgId, vesselId);

      logger.info("SchedulingSettings", "Settings reset to defaults", { orgId, vesselId });
      res.json(reset);
    })
  );

  logger.info("[SchedulingRoutes] Scheduling settings routes registered");
}
