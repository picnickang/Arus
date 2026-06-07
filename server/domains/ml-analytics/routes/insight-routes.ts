/**
 * ML Analytics - Insight Snapshot Routes
 *
 * Routes for insight snapshots.
 */

import type { Express } from "express";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import { authenticatedRequest } from "../../../middleware/auth";
import { analyticsInsightsAdapter, dbAnalyticsStorage } from "../../../repositories.js";

export function registerInsightRoutes(app: Express, _config: MlAnalyticsConfig) {
  app.get(
    "/api/analytics/insight-snapshots",
    withErrorHandling("fetch insight snapshots", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId, scope } = req.query;
      const snapshots = await analyticsInsightsAdapter.getInsightSnapshots(
        orgId as string,
        scope as string
      );
      const { normalizeInsightSnapshots } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeInsightSnapshots(snapshots));
    })
  );

  app.get(
    "/api/analytics/insight-snapshots/latest",
    withErrorHandling("fetch latest insight snapshot", async (req, res) => {
      const { scope = "fleet", orgId = authenticatedRequest(req).orgId } = req.query;
      const snapshot = await dbAnalyticsStorage.getLatestInsightSnapshot(
        orgId as string,
        scope as string
      );
      if (!snapshot) {
        return sendNotFound(res, "Insight snapshot");
      }
      const { normalizeInsightSnapshot } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeInsightSnapshot(snapshot));
    })
  );
}
