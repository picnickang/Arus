// @ts-nocheck
/**
 * ML Analytics - Insight Snapshot Routes
 *
 * Routes for insight snapshots.
 */

import type { Express } from "express";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { analyticsInsightsAdapter, dbAnalyticsStorage } from "../../../repositories.js";

export function registerInsightRoutes(app: Express, _config: MlAnalyticsConfig) {
  app.get(
    "/api/analytics/insight-snapshots",
    withErrorHandling("fetch insight snapshots", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, scope, limit } = req.query;
      const snapshots = await analyticsInsightsAdapter.getInsightSnapshots(
        orgId as string,
        scope as string,
        limit ? Number.parseInt(limit as string) : undefined
      );
      const { normalizeInsightSnapshots } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeInsightSnapshots(snapshots));
    })
  );

  app.get(
    "/api/analytics/insight-snapshots/latest",
    withErrorHandling("fetch latest insight snapshot", async (req, res) => {
      const { scope = "fleet", orgId = (req as AuthenticatedRequest).orgId } = req.query;
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
