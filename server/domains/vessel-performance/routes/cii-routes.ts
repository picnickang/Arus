/**
 * Vessel Performance Routes - CII Compliance Endpoints
 */

import type { Express, Response } from "express";
import { generalApiRateLimit } from "../../../middleware/rate-limiters";
import type { VesselPerformanceRoutesConfig, AuthenticatedRequest } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { requireOrgId } from "../../../middleware/auth.js";

async function getCIIService() {
  const { CIIService } = await import("../../../cii-service.js");
  return new CIIService();
}

export function registerCIIRoutes(app: Express, _config: VesselPerformanceRoutesConfig): void {
  app.get(
    "/api/compliance/cii/:vesselId",
    generalApiRateLimit,
    requireOrgId,
    withErrorHandling("calculate CII rating", async (req: AuthenticatedRequest, res: Response) => {
      const { vesselId = "" } = req.params;
      const orgId = req.orgId;

      const ciiService = await getCIIService();

      const now = new Date();
      const startDate = req.query["startDate"]
        ? new Date(req.query["startDate"] as string)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query["endDate"] ? new Date(req.query["endDate"] as string) : now;

      const rating = await ciiService.calculateCIIFromTelemetry(
        vesselId,
        orgId,
        startDate,
        endDate
      );
      if (!rating) {
        return res.status(404).json({
          message: "Insufficient data to calculate CII rating",
          suggestion: "Ensure vessel has fuel consumption and speed telemetry data",
        });
      }

      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.json(rating);
    })
  );

  app.get(
    "/api/compliance/cii/:vesselId/trend",
    generalApiRateLimit,
    requireOrgId,
    withErrorHandling("get CII trend", async (req: AuthenticatedRequest, res: Response) => {
      const { vesselId = "" } = req.params;
      const orgId = req.orgId;

      const ciiService = await getCIIService();
      const trend = await ciiService.getCIITrend(vesselId, orgId);

      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.json({ vesselId, trend, monthsAvailable: trend.length });
    })
  );
}
