/**
 * Vessel Performance Routes - CII Compliance Endpoints
 */

import type { Express, Request, Response } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";

export function registerCIIRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {
  const { storage } = config;

  app.get("/api/compliance/cii/:vesselId", withErrorHandling("calculate CII rating", async (req: Request, res: Response) => {
    const { vesselId } = req.params, orgId = req.headers["x-org-id"] as string;
    if (!orgId) {return res.status(400).json({ message: "Organization ID is required" });}

    const { CIIService } = await import("../../../cii-service.js");
    const ciiService = new CIIService(storage);

    const now = new Date();
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;

    const rating = await ciiService.calculateCIIFromTelemetry(vesselId, orgId, startDate, endDate);
    if (!rating) {return res.status(404).json({ message: "Insufficient data to calculate CII rating", suggestion: "Ensure vessel has fuel consumption and speed telemetry data" });}

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(rating);
  }));

  app.get("/api/compliance/cii/:vesselId/trend", withErrorHandling("get CII trend", async (req: Request, res: Response) => {
    const { vesselId } = req.params, orgId = req.headers["x-org-id"] as string;
    if (!orgId) {return res.status(400).json({ message: "Organization ID is required" });}

    const { CIIService } = await import("../../../cii-service.js");
    const ciiService = new CIIService(storage);
    const trend = await ciiService.getCIITrend(vesselId, orgId);

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({ vesselId, trend, monthsAvailable: trend.length });
  }));
}
