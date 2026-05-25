/**
 * Vessel Performance Routes - Narrative Summary
 */

import type { Express, Response } from "express";
import type { VesselPerformanceRoutesConfig, AuthenticatedRequest } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { requireOrgId } from "../../../middleware/auth.js";
import { vesselService } from "../../../services/domains/vessel-service.js";

export function registerNarrativeRoutes(app: Express, _config: VesselPerformanceRoutesConfig): void {
  app.post(
    "/api/analytics/narrative-summary",
    requireOrgId,
    withErrorHandling("generate narrative summary", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId;

      const { NarrativeSummaryService } = await import("../../../narrative-summary-service.js");
      const narrativeService = new NarrativeSummaryService();

      const input = req.body as { vesselId?: unknown; chartType?: unknown };
      if (typeof input.vesselId !== "string" || typeof input.chartType !== "string") {
        return res.status(400).json({ message: "vesselId and chartType are required" });
      }

      // Tenant-scope the request: the vessel must belong to the caller's org.
      // Without this check, a caller could request a narrative summary for any
      // vessel ID even though the underlying generator ignored orgId.
      const vessel = await vesselService.getVessel(input.vesselId, orgId);
      if (!vessel) {
        return res.status(404).json({ message: "Vessel not found" });
      }

      const summary = await narrativeService.generate(input as Parameters<typeof narrativeService.generate>[0]);

      res.setHeader("Cache-Control", "private, max-age=300");
      return res.json(summary);
    })
  );
}
