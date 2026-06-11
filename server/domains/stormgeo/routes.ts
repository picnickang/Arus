import { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import { dbStormGeoStorage } from "../../db/stormgeo/index.js";
import { stormgeoIntegrationService } from "../../services/stormgeo-integration-service";

interface StormGeoConfig {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
}

const vesselIdQuerySchema = z.object({
  vesselId: z.string().optional(),
});

const importBodySchema = z.object({
  vesselId: z.string().min(1),
  fileName: z.string().optional(),
  fileContent: z.string().min(1),
  fileType: z.string().optional(),
});

const importHistoryQuerySchema = z.object({
  vesselId: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const snapshotsQuerySchema = z.object({
  vesselId: z.string().min(1),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

const weatherForTimeQuerySchema = z.object({
  vesselId: z.string().min(1),
  timestamp: z.string().min(1),
});

const autoFillHourlySchema = z.object({
  vesselId: z.string().min(1),
  logDate: z.string().min(1),
  hour: z.number().int().min(0).max(23),
});

const idParamSchema = z.object({ id: z.string().min(1) });
const routeIdParamSchema = z.object({ routeId: z.string().min(1) });
const settingsBodySchema = jsonRecordSchema;

// Credentials are write-only: API responses carry hasApiKey/hasSftpPassword
// booleans instead of the stored apiKey/sftpPassword values.
function redactStormgeoSettings<T extends { apiKey?: string | null; sftpPassword?: string | null }>(
  settings: T | null | undefined
) {
  if (!settings) return null;
  const { apiKey, sftpPassword, ...rest } = settings;
  return { ...rest, hasApiKey: Boolean(apiKey), hasSftpPassword: Boolean(sftpPassword) };
}

export function registerStormGeoRoutes(app: Express, config: StormGeoConfig) {
  const { writeOperationRateLimit } = config;

  app.get(
    "/api/stormgeo/settings",
    withErrorHandling("get StormGeo settings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId } = vesselIdQuerySchema.parse(req.query);
      const settings = await dbStormGeoStorage.getStormgeoSettings(orgId, vesselId);
      const row = Array.isArray(settings) ? settings[0] : settings;
      res.json(redactStormgeoSettings(row));
    })
  );

  app.post(
    "/api/stormgeo/settings",
    writeOperationRateLimit,
    withErrorHandling("save StormGeo settings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const body = settingsBodySchema.parse(req.body);
      const settings = await stormgeoIntegrationService.upsertSettings({
        ...body,
        orgId,
      } as Parameters<typeof stormgeoIntegrationService.upsertSettings>[0]);
      const row = Array.isArray(settings) ? settings[0] : settings;
      res.json(redactStormgeoSettings(row));
    })
  );

  app.delete(
    "/api/stormgeo/settings/:id",
    writeOperationRateLimit,
    withErrorHandling("delete StormGeo settings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      void orgId;
      const { id } = idParamSchema.parse(req.params);
      await dbStormGeoStorage.deleteStormgeoSetting(id);
      res.json({ success: true });
    })
  );

  app.post(
    "/api/stormgeo/import",
    writeOperationRateLimit,
    withErrorHandling("import StormGeo data", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const parsed = importBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "vesselId and fileContent are required" });
        return;
      }
      const { vesselId, fileName, fileContent, fileType } = parsed.data;

      let result;
      if (fileType === "json" || fileName?.endsWith(".json")) {
        result = await stormgeoIntegrationService.importJSON(
          orgId,
          vesselId,
          fileContent,
          fileName || "import.json"
        );
      } else {
        result = await stormgeoIntegrationService.importCSV(
          orgId,
          vesselId,
          fileContent,
          fileName || "import.csv"
        );
      }

      res.json(result);
    })
  );

  app.get(
    "/api/stormgeo/import-history",
    withErrorHandling("get StormGeo import history", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, limit } = importHistoryQuerySchema.parse(req.query);
      const rows = await dbStormGeoStorage.getStormgeoImportHistory(orgId, vesselId);
      const history = typeof limit === "number" ? rows.slice(0, limit) : rows;
      res.json(history);
    })
  );

  app.get(
    "/api/stormgeo/snapshots",
    withErrorHandling("get StormGeo snapshots", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const parsed = snapshotsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "vesselId is required" });
        return;
      }
      const { vesselId, startTime, endTime } = parsed.data;
      const startDate = startTime ? new Date(startTime) : undefined;
      const endDate = endTime ? new Date(endTime) : undefined;

      const snapshots = await stormgeoIntegrationService.getSnapshots(
        orgId,
        vesselId,
        startDate,
        endDate
      );
      res.json(snapshots);
    })
  );

  app.get(
    "/api/stormgeo/weather-for-time",
    withErrorHandling("get weather for time", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const parsed = weatherForTimeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "vesselId and timestamp are required" });
        return;
      }
      const { vesselId, timestamp } = parsed.data;

      const snapshot = await stormgeoIntegrationService.getWeatherForTime(
        vesselId,
        new Date(timestamp),
        orgId
      );
      res.json(snapshot || null);
    })
  );

  app.post(
    "/api/stormgeo/autofill-hourly",
    writeOperationRateLimit,
    withErrorHandling("auto-fill hourly entry", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const parsed = autoFillHourlySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "vesselId, logDate, and hour are required" });
        return;
      }
      const { vesselId, logDate, hour } = parsed.data;

      const result = await stormgeoIntegrationService.autoFillHourlyEntry(
        vesselId,
        logDate,
        hour,
        orgId
      );

      if (!result) {
        res.json({
          success: false,
          message: "No weather data available for this time",
        });
        return;
      }

      res.json({
        success: true,
        fields: result.fields,
        source: result.source,
        snapshotId: result.snapshotId,
      });
    })
  );

  app.post(
    "/api/stormgeo/autofill-daily",
    writeOperationRateLimit,
    withErrorHandling("bulk auto-fill hourly entries", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      if (!orgId) {
        res.status(401).json({ error: "Organization ID required" });
        return;
      }

      const bulkAutoFillSchema = z.object({
        vesselId: z.string().uuid(),
        logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        skipExisting: z.boolean().optional().default(true),
      });

      const parseResult = bulkAutoFillSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
        return;
      }

      const { vesselId, logDate } = parseResult.data;

      const results: Record<
        number,
        { fields: Record<string, unknown>; source: string; snapshotId?: string }
      > = {};
      let filledCount = 0;

      for (let hour = 0; hour < 24; hour++) {
        try {
          const result = await stormgeoIntegrationService.autoFillHourlyEntry(
            vesselId,
            logDate,
            hour,
            orgId
          );

          if (result) {
            results[hour] = result;
            filledCount++;
          }
        } catch {
          logger.info("StormGeo", `No weather data for hour ${hour}`);
        }
      }

      res.json({
        success: filledCount > 0,
        filledCount,
        results,
      });
    })
  );

  app.delete(
    "/api/stormgeo/snapshots/route/:routeId",
    writeOperationRateLimit,
    withErrorHandling("delete StormGeo snapshots", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      void orgId;
      const { routeId } = routeIdParamSchema.parse(req.params);
      void routeId;
      await dbStormGeoStorage.deleteStormgeoSnapshotsBefore(new Date());
      res.json({ success: true });
    })
  );

  logger.info("StormGeoRoutes", "Registered (10 endpoints)");
}
