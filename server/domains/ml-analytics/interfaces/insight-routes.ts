/**
 * ML Analytics - Insight Snapshot Routes
 *
 * Routes for insight snapshots. Data access lives in the application service;
 * this layer only handles HTTP concerns.
 */

import type { Express } from "express";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import { authenticatedRequest } from "../../../middleware/auth";
import { mlAnalyticsService } from "../application/index.js";

export function registerInsightRoutes(app: Express, _config: MlAnalyticsConfig) {
  app.get(
    "/api/analytics/insight-snapshots",
    withErrorHandling("fetch insight snapshots", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId, scope } = req.query;
      res.json(
        await mlAnalyticsService.listInsightSnapshots(orgId as string, scope as string)
      );
    })
  );

  app.get(
    "/api/analytics/insight-snapshots/latest",
    withErrorHandling("fetch latest insight snapshot", async (req, res) => {
      const { scope = "fleet", orgId = authenticatedRequest(req).orgId } = req.query;
      const snapshot = await mlAnalyticsService.getLatestInsightSnapshot(
        orgId as string,
        scope as string
      );
      if (!snapshot) {
        return sendNotFound(res, "Insight snapshot");
      }
      res.json(snapshot);
    })
  );
}
