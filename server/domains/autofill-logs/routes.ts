/**
 * Auto-Filled Logs Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 *
 * Routes for fuel emissions, vessel track, and condition monitoring logs
 * These logs are auto-filled from telemetry data
 */

import { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface AutofillLogsDependencies {
  writeOperationRateLimit: RequestHandler;
}

const fuelListQuerySchema = z.object({
  vesselId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  periodType: z.string().optional(),
});

const fuelSummaryQuerySchema = z.object({
  vesselId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

const trackQuerySchema = z.object({
  vesselId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  limit: z.coerce.number().int().positive().optional(),
});

const trackStatsQuerySchema = z.object({
  vesselId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

const lastPositionQuerySchema = z.object({
  vesselId: z.string().min(1),
});

const trackExportQuerySchema = z.object({
  vesselId: z.string().min(1),
  vesselName: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

const conditionListQuerySchema = z.object({
  vesselId: z.string().optional(),
  equipmentId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  periodType: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const equipmentParamSchema = z.object({ equipmentId: z.string().min(1) });
const vesselParamSchema = z.object({ vesselId: z.string().min(1) });

const conditionHistoryQuerySchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  limit: z.coerce.number().int().positive().optional(),
});

const vesselConditionSummaryQuerySchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export function registerAutofillLogsRoutes(app: Express, deps: AutofillLogsDependencies): void {
  const { writeOperationRateLimit } = deps;

  // ==================================================================================
  // FUEL & EMISSIONS LOG ROUTES
  // ==================================================================================

  app.get(
    "/api/logbook/fuel-emissions",
    withErrorHandling("get fuel emissions logs", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, startDate, endDate, periodType } = fuelListQuerySchema.parse(req.query);

      const { fuelEmissionsLog } = await import("@shared/schema");
      const { eq, and, gte, lte, sql } = await import("drizzle-orm");
      const { db } = await import("../../db");

      const conditions = [eq(fuelEmissionsLog.orgId, orgId)];
      if (vesselId) {
        conditions.push(eq(fuelEmissionsLog.vesselId, vesselId));
      }

      if (startDate) {
        conditions.push(gte(fuelEmissionsLog.periodStart, new Date(startDate)));
      }

      if (endDate) {
        conditions.push(lte(fuelEmissionsLog.periodEnd, new Date(endDate)));
      }

      if (periodType) {
        conditions.push(eq(fuelEmissionsLog.periodType, periodType));
      }

      const logs = await db
        .select()
        .from(fuelEmissionsLog)
        .where(and(...conditions))
        .orderBy(sql`${fuelEmissionsLog.periodStart} DESC`)
        .limit(1000);

      res.json(logs);
    })
  );

  app.get(
    "/api/logbook/fuel-emissions/summary",
    withErrorHandling("get fuel emissions summary", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const parsed = fuelSummaryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }
      const { vesselId, startDate, endDate } = parsed.data;

      const { fuelEmissionsAutoFillService } = await import(
        "../../services/fuel-emissions-autofill-service"
      );
      const summary = await fuelEmissionsAutoFillService.getFuelEmissionsSummary(
        orgId,
        vesselId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json(summary);
    })
  );

  app.post(
    "/api/logbook/fuel-emissions/autofill",
    writeOperationRateLimit,
    withErrorHandling("auto-fill fuel emissions", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const autoFillSchema = z.object({
        vesselId: z.string().uuid(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        periodType: z.enum(["hourly", "daily"]).optional().default("hourly"),
      });

      const parseResult = autoFillSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
        return;
      }

      const { vesselId, startDate, endDate, periodType } = parseResult.data;

      const { fuelEmissionsAutoFillService } = await import(
        "../../services/fuel-emissions-autofill-service"
      );
      const result = await fuelEmissionsAutoFillService.autoFillFuelEmissions(
        orgId,
        vesselId,
        new Date(startDate),
        new Date(endDate),
        periodType
      );

      res.json(result);
    })
  );

  // ==================================================================================
  // VESSEL TRACK LOG ROUTES
  // ==================================================================================

  app.get(
    "/api/logbook/track",
    withErrorHandling("get vessel track", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const parsed = trackQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }
      const { vesselId, startDate, endDate, limit } = parsed.data;

      const { trackLogService } = await import("../../services/track-log-service");
      const tracks = await trackLogService.getTrackHistory(
        orgId,
        vesselId,
        new Date(startDate),
        new Date(endDate),
        limit
      );

      res.json(tracks);
    })
  );

  app.get(
    "/api/logbook/track/stats",
    withErrorHandling("get track stats", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const parsed = trackStatsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }
      const { vesselId, startDate, endDate } = parsed.data;

      const { trackLogService } = await import("../../services/track-log-service");
      const stats = await trackLogService.getTrackStats(
        orgId,
        vesselId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json(stats);
    })
  );

  app.get(
    "/api/logbook/track/last-position",
    withErrorHandling("get last position", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const parsed = lastPositionQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "vesselId is required" });
        return;
      }
      const { vesselId } = parsed.data;

      const { trackLogService } = await import("../../services/track-log-service");
      const position = await trackLogService.getLastPosition(orgId, vesselId);

      if (!position) {
        sendNotFound(res, "Position");
        return;
      }

      res.json(position);
    })
  );

  app.get(
    "/api/logbook/track/export/gpx",
    withErrorHandling("export track as GPX", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const parsed = trackExportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }
      const { vesselId, vesselName, startDate, endDate } = parsed.data;

      const { trackLogService } = await import("../../services/track-log-service");
      const gpx = await trackLogService.exportToGPX(
        orgId,
        vesselId,
        vesselName || "Vessel",
        new Date(startDate),
        new Date(endDate)
      );

      res.setHeader("Content-Type", "application/gpx+xml");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="track-${vesselId}-${startDate}.gpx"`
      );
      res.send(gpx);
    })
  );

  app.post(
    "/api/logbook/track/process-telemetry",
    writeOperationRateLimit,
    withErrorHandling("process GPS telemetry", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const processSchema = z.object({
        vesselId: z.string().uuid(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      });

      const parseResult = processSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
        return;
      }

      const { vesselId, startDate, endDate } = parseResult.data;

      const { trackLogService } = await import("../../services/track-log-service");
      const result = await trackLogService.processGpsTelemetry(
        orgId,
        vesselId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json(result);
    })
  );

  // ==================================================================================
  // CONDITION MONITORING LOG ROUTES
  // ==================================================================================

  app.get(
    "/api/logbook/condition",
    withErrorHandling("get condition logs", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, equipmentId, startDate, endDate, periodType, limit } =
        conditionListQuerySchema.parse(req.query);

      const { conditionLogSummary } = await import("@shared/schema");
      const { eq, and, gte, lte, sql } = await import("drizzle-orm");
      const { db } = await import("../../db");

      const conditions = [eq(conditionLogSummary.orgId, orgId)];
      if (vesselId) {
        conditions.push(eq(conditionLogSummary.vesselId, vesselId));
      }

      if (equipmentId) {
        conditions.push(eq(conditionLogSummary.equipmentId, equipmentId));
      }

      if (startDate) {
        conditions.push(gte(conditionLogSummary.periodStart, new Date(startDate)));
      }

      if (endDate) {
        conditions.push(lte(conditionLogSummary.periodEnd, new Date(endDate)));
      }

      if (periodType) {
        conditions.push(
          eq(
            (conditionLogSummary as unknown as Record<string, import("drizzle-orm/pg-core").PgColumn>).periodType,
            periodType
          )
        );
      }

      let query = db
        .select()
        .from(conditionLogSummary)
        .where(and(...conditions))
        .orderBy(sql`${conditionLogSummary.periodStart} DESC`);

      if (limit) {
        query = query.limit(limit) as typeof query;
      }

      const logs = await query;
      res.json(logs);
    })
  );

  app.get(
    "/api/logbook/condition/equipment/:equipmentId",
    withErrorHandling("get condition log history", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { equipmentId } = equipmentParamSchema.parse(req.params);
      const { startDate, endDate, limit } = conditionHistoryQuerySchema.parse(req.query);

      const { conditionLogService } = await import("../../services/condition-log-service");
      const history = await conditionLogService.getConditionLogHistory(
        orgId,
        equipmentId,
        new Date(startDate),
        new Date(endDate),
        limit
      );

      res.json(history);
    })
  );

  app.get(
    "/api/logbook/condition/vessel/:vesselId/summary",
    withErrorHandling("get vessel condition summary", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId } = vesselParamSchema.parse(req.params);
      const { startDate, endDate } = vesselConditionSummaryQuerySchema.parse(req.query);

      const { conditionLogService } = await import("../../services/condition-log-service");
      const summary = await conditionLogService.getVesselConditionSummary(
        orgId,
        vesselId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json(summary);
    })
  );

  app.post(
    "/api/logbook/condition/autofill",
    writeOperationRateLimit,
    withErrorHandling("auto-fill condition logs", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const autoFillSchema = z.object({
        vesselId: z.string().uuid(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        periodType: z.enum(["hourly", "daily"]).optional().default("hourly"),
      });

      const parseResult = autoFillSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
        return;
      }

      const { vesselId, startDate, endDate, periodType } = parseResult.data;

      const { conditionLogService } = await import("../../services/condition-log-service");
      const result = await conditionLogService.autoFillConditionLogs(
        orgId,
        vesselId,
        new Date(startDate),
        new Date(endDate),
        periodType
      );

      res.json(result);
    })
  );

  logger.info("AutofillLogsRoutes", "Registered (fuel: 3, track: 5, condition: 4)");
}
