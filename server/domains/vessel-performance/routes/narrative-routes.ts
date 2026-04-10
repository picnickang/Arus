/**
 * Vessel Performance Routes - Narrative Summary
 */

import type { Express, Request, Response } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { storage } from "../../../storage.js";

export function registerNarrativeRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {

  app.post("/api/analytics/narrative-summary", withErrorHandling("generate narrative summary", async (req: Request, res: Response) => {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) {return res.status(400).json({ message: "Organization ID is required" });}

    const { NarrativeSummaryService } = await import("../../../narrative-summary-service.js");
    const narrativeService = new NarrativeSummaryService(storage);

    const input = req.body;
    if (!input.vesselId || !input.chartType) {return res.status(400).json({ message: "vesselId and chartType are required" });}

    const summary = await narrativeService.generateSummary(input);

    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(summary);
  }));
}
