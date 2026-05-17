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

export function registerAutofillLogsRoutes(app: Express, deps: AutofillLogsDependencies): void {
  const { writeOperationRateLimit } = deps;

  // ==================================================================================
  // FUEL & EMISSIONS LOG ROUTES
  // ==================================================================================

  app.get(
    "/api/logbook/fuel-emissions",
    withErrorHandling("get fuel emissions logs", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, startDate, endDate, periodType } = req.query;

      const { fuelEmissionsLog } = await import("@shared/schema");
      const { eq, and, gte, lte, sql } = await import("drizzle-orm");
      const { db } = await import("../../db");

      const conditions = [eq(fuelEmissionsLog.orgId, orgId)];
      if (vesselId) {
        conditions.push(eq(fuelEmissionsLog.vesselId, vesselId as string));
      }

      if (startDate) {
        conditions.push(gte(fuelEmissionsLog.periodStart, new Date(startDate as string)));
      }

      if (endDate) {
        conditions.push(lte(fuelEmissionsLog.periodEnd, new Date(endDate as string)));
      }

      if (periodType) {
        conditions.push(eq(fuelEmissionsLog.periodType, periodType as string));
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
      const { vesselId, startDate, endDate } = req.query;

      if (!vesselId || !startDate || !endDate) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }

      const { fuelEmissionsAutoFillService } = await import(
        "../../services/fuel-emissions-autofill-service"
      );
      const summary = await fuelEmissionsAutoFillService.getFuelEmissionsSummary(
        orgId,
        vesselId as string,
        new Date(startDate as string),
        new Date(endDate as string)
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
      const { vesselId, startDate, endDate, limit } = req.query;

      if (!vesselId || !startDate || !endDate) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }

      const { trackLogService } = await import("../../services/track-log-service");
      const tracks = await trackLogService.getTrackHistory(
        orgId,
        vesselId as string,
        new Date(startDate as string),
        new Date(endDate as string),
        limit ? Number.parseInt(limit as string) : undefined
      );

      res.json(tracks);
    })
  );

  app.get(
    "/api/logbook/track/stats",
    withErrorHandling("get track stats", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, startDate, endDate } = req.query;

      if (!vesselId || !startDate || !endDate) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }

      const { trackLogService } = await import("../../services/track-log-service");
      const stats = await trackLogService.getTrackStats(
        orgId,
        vesselId as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json(stats);
    })
  );

  app.get(
    "/api/logbook/track/last-position",
    withErrorHandling("get last position", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId } = req.query;

      if (!vesselId) {
        res.status(400).json({ error: "vesselId is required" });
        return;
      }

      const { trackLogService } = await import("../../services/track-log-service");
      const position = await trackLogService.getLastPosition(orgId, vesselId as string);

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
      const { vesselId, vesselName, startDate, endDate } = req.query;

      if (!vesselId || !startDate || !endDate) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }

      const { trackLogService } = await import("../../services/track-log-service");
      const gpx = await trackLogService.exportToGPX(
        orgId,
        vesselId as string,
        (vesselName as string) || "Vessel",
        new Date(startDate as string),
        new Date(endDate as string)
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
      const { vesselId, equipmentId, startDate, endDate, periodType, limit } = req.query;

      const { conditionLogSummary } = await import("@shared/schema");
      const { eq, and, gte, lte, sql } = await import("drizzle-orm");
      const { db } = await import("../../db");

      const conditions = [eq(conditionLogSummary.orgId, orgId)];
      if (vesselId) {
        conditions.push(eq(conditionLogSummary.vesselId, vesselId as string));
      }

      if (equipmentId) {
        conditions.push(eq(conditionLogSummary.equipmentId, equipmentId as string));
      }

      if (startDate) {
        conditions.push(gte(conditionLogSummary.periodStart, new Date(startDate as string)));
      }

      if (endDate) {
        conditions.push(lte(conditionLogSummary.periodEnd, new Date(endDate as string)));
      }

      if (periodType) {
        conditions.push(eq((conditionLogSummary as any).periodType, periodType as string));
      }

      let query = db
        .select()
        .from(conditionLogSummary)
        .where(and(...conditions))
        .orderBy(sql`${conditionLogSummary.periodStart} DESC`);

      if (limit) {
        query = query.limit(Number.parseInt(limit as string)) as typeof query;
      }

      const logs = await query;
      res.json(logs);
    })
  );

  app.get(
    "/api/logbook/condition/equipment/:equipmentId",
    withErrorHandling("get condition log history", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { equipmentId } = req.params;
      const { startDate, endDate, limit } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: "startDate and endDate are required" });
        return;
      }

      const { conditionLogService } = await import("../../services/condition-log-service");
      const history = await conditionLogService.getConditionLogHistory(
        orgId,
        equipmentId,
        new Date(startDate as string),
        new Date(endDate as string),
        limit ? Number.parseInt(limit as string) : undefined
      );

      res.json(history);
    })
  );

  app.get(
    "/api/logbook/condition/vessel/:vesselId/summary",
    withErrorHandling("get vessel condition summary", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: "startDate and endDate are required" });
        return;
      }

      const { conditionLogService } = await import("../../services/condition-log-service");
      const summary = await conditionLogService.getVesselConditionSummary(
        orgId,
        vesselId,
        new Date(startDate as string),
        new Date(endDate as string)
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
