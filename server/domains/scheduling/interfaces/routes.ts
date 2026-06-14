import { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils";
import { validateResponse } from "../../../lib/api-helpers";
import { authenticatedRequest } from "../../../middleware/auth";
import { optimizationDirectory } from "../../../composition/optimization-directory.js";
import { SchedulingService } from "../application";
import { optimizerRepository } from "../infrastructure";
import type { ISchedulingMaintenancePort } from "../domain/ports";
import type { InsertMaintenanceSchedule } from "../domain/types";
import { registerSchedulingSettingsRoutes } from "./scheduling-settings-routes";
import type { WidenPartial } from "../../../lib/widen-partial";

interface SchedulingConfig {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
  /** Injected cross-domain maintenance accessor (wired in composition). */
  maintenance: ISchedulingMaintenancePort;
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

function orgIdFromRequest(req: Request): string {
  return authenticatedRequest(req).orgId;
}

export function registerSchedulingRoutes(app: Express, config: SchedulingConfig) {
  const { requireOrgId, writeOperationRateLimit, maintenance } = config;
  const service = new SchedulingService(maintenance, optimizerRepository, optimizationDirectory);

  app.get(
    "/api/schedule",
    requireOrgId,
    withErrorHandling("fetch maintenance schedules", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { vesselId, equipmentId, status, dateFrom, dateTo } = scheduleListQuerySchema.parse(
        req.query
      );
      const schedules = await service.listSchedules(orgId, {
        equipmentId,
        vesselId,
        status,
        startDate: dateFrom ? new Date(dateFrom) : undefined,
        endDate: dateTo ? new Date(dateTo) : undefined,
      });
      res.json(schedules);
    })
  );

  app.get(
    "/api/schedule/conflicts",
    requireOrgId,
    withErrorHandling("detect conflicts", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { dateFrom, dateTo, vesselId } = scheduleConflictsQuerySchema.parse(req.query);
      const conflicts = await service.detectConflicts(orgId, {
        vesselId,
        startDate: dateFrom ? new Date(dateFrom) : undefined,
        endDate: dateTo ? new Date(dateTo) : undefined,
      });
      res.json(conflicts);
    })
  );

  app.get(
    "/api/schedule/calendar",
    requireOrgId,
    withErrorHandling("fetch calendar data", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { month, year, vesselId } = calendarQuerySchema.parse(req.query);
      const calendarData = await service.getCalendar(orgId, { vesselId, month, year });
      res.json(calendarData);
    })
  );

  app.get(
    "/api/schedule/stats",
    requireOrgId,
    withErrorHandling("fetch schedule statistics", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { vesselId, months } = statsQuerySchema.parse(req.query);
      const stats = await service.getStats(orgId, { vesselId, months });
      res.json(stats);
    })
  );

  app.get(
    "/api/schedule/upcoming",
    requireOrgId,
    withErrorHandling("fetch upcoming maintenance", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { days, vesselId, limit } = upcomingQuerySchema.parse(req.query);
      const upcoming = await service.getUpcoming(orgId, { vesselId, days, limit });
      res.json(upcoming);
    })
  );

  app.get(
    "/api/schedule/:id",
    requireOrgId,
    withErrorHandling("fetch schedule", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { id } = idParamSchema.parse(req.params);
      const schedule = await service.getSchedule(id, orgId);
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
      const schedule = await service.createSchedule({
        ...body,
        orgId,
      } as InsertMaintenanceSchedule);
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
      const schedule = await service.updateSchedule(
        id,
        body as WidenPartial<InsertMaintenanceSchedule>,
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
      await service.deleteSchedule(id, orgId);
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
      const results = await service.createBulkSchedules(
        schedules.map((s) => ({ ...s, orgId })) as InsertMaintenanceSchedule[]
      );
      sendCreated(res, results);
    })
  );

  app.get(
    "/api/optimization/dashboard",
    requireOrgId,
    withErrorHandling("fetch optimization dashboard", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const dashboard = await service.getOptimizationDashboard(orgId);
      res.json(
        validateResponse(
          optimizationDashboardResponseSchema,
          dashboard,
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
      const configs = await service.listOptimizerConfigurations(orgId);
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
      const config = await service.createOptimizerConfiguration({
        ...body,
        orgId,
      } as Parameters<typeof service.createOptimizerConfiguration>[0]);
      sendCreated(res, config);
    })
  );

  app.get(
    "/api/optimization/results",
    requireOrgId,
    withErrorHandling("fetch optimization results", async (req: Request, res: Response) => {
      const orgId = orgIdFromRequest(req);
      const { dateFrom, dateTo } = optimizationResultsQuerySchema.parse(req.query);
      const results = await service.listOptimizationResults(
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
      const result = await service.createOptimizationResult({
        ...body,
        orgId,
      } as Parameters<typeof service.createOptimizationResult>[0]);
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
      const result = await service.runOptimization(orgId, configId, targetDate);
      res.json(result);
    })
  );

  registerSchedulingSettingsRoutes(app, {
    requireOrgId,
    writeOperationRateLimit,
  });
}
