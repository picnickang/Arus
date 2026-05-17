// @ts-nocheck
/**
 * Vessel Performance Routes - Narrative Summary
 */

import type { Express, Request, Response } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export function registerNarrativeRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {
  app.post(
    "/api/analytics/narrative-summary",
    withErrorHandling("generate narrative summary", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;

      const { NarrativeSummaryService } = await import("../../../narrative-summary-service.js");
      const narrativeService = new NarrativeSummaryService();

      const input = req.body;
      if (!input.vesselId || !input.chartType) {
        return res.status(400).json({ message: "vesselId and chartType are required" });
      }

      const summary = await narrativeService.generateSummary(input);

      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(summary);
    })
  );
}
