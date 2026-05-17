import { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import { dbStormGeoStorage } from "../../db/stormgeo/index.js";
import { stormgeoIntegrationService } from "../../services/stormgeo-integration-service";

interface StormGeoConfig {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
}

export function registerStormGeoRoutes(app: Express, config: StormGeoConfig) {
  const { requireOrgId, generalApiRateLimit, writeOperationRateLimit } = config;

  app.get(
    "/api/stormgeo/settings",
    withErrorHandling("get StormGeo settings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const vesselId = req.query.vesselId as string | undefined;
      const settings = await dbStormGeoStorage.getStormgeoSettings(orgId, vesselId);
      res.json(settings || null);
    })
  );

  app.post(
    "/api/stormgeo/settings",
    writeOperationRateLimit,
    withErrorHandling("save StormGeo settings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const settings = await stormgeoIntegrationService.upsertSettings({
        ...req.body,
        orgId,
      });
      res.json(settings);
    })
  );

  app.delete(
    "/api/stormgeo/settings/:id",
    writeOperationRateLimit,
    withErrorHandling("delete StormGeo settings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      // @ts-ignore -- bulk-silence
      await dbStormGeoStorage.deleteStormgeoSetting(req.params.id, orgId);
      res.json({ success: true });
    })
  );

  app.post(
    "/api/stormgeo/import",
    writeOperationRateLimit,
    withErrorHandling("import StormGeo data", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, fileName, fileContent, fileType } = req.body;

      if (!vesselId || !fileContent) {
        res.status(400).json({ error: "vesselId and fileContent are required" });
        return;
      }

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
      const vesselId = req.query.vesselId as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      // @ts-ignore -- bulk-silence
      const history = await dbStormGeoStorage.getStormgeoImportHistory(orgId, { vesselId, limit });
      res.json(history);
    })
  );

  app.get(
    "/api/stormgeo/snapshots",
    withErrorHandling("get StormGeo snapshots", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const vesselId = req.query.vesselId as string;
      const startTime = req.query.startTime ? new Date(req.query.startTime as string) : undefined;
      const endTime = req.query.endTime ? new Date(req.query.endTime as string) : undefined;

      if (!vesselId) {
        res.status(400).json({ error: "vesselId is required" });
        return;
      }

      const snapshots = await stormgeoIntegrationService.getSnapshots(
        orgId,
        vesselId,
        startTime,
        endTime
      );
      res.json(snapshots);
    })
  );

  app.get(
    "/api/stormgeo/weather-for-time",
    withErrorHandling("get weather for time", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const vesselId = req.query.vesselId as string;
      const timestamp = req.query.timestamp as string;

      if (!vesselId || !timestamp) {
        res.status(400).json({ error: "vesselId and timestamp are required" });
        return;
      }

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
      const { vesselId, logDate, hour } = req.body;

      if (!vesselId || !logDate || hour === undefined) {
        res.status(400).json({ error: "vesselId, logDate, and hour are required" });
        return;
      }

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
      // @ts-ignore -- bulk-silence
      await dbStormGeoStorage.deleteStormgeoSnapshotsBefore(req.params.routeId, orgId);
      res.json({ success: true });
    })
  );

  logger.info("StormGeoRoutes", "Registered (10 endpoints)");
}
