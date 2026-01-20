/**
 * ML Analytics - Insight Snapshot Routes
 * 
 * Routes for insight snapshots.
 */

import type { Express } from "express";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerInsightRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage } = config;

  app.get("/api/analytics/insight-snapshots",
    withErrorHandling("fetch insight snapshots", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, scope, limit } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const snapshots = await storage.getInsightSnapshots(
        orgId as string,
        scope as string,
        limit ? Number.parseInt(limit as string) : undefined
      );
      const { normalizeInsightSnapshots } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeInsightSnapshots(snapshots));
    })
  );

  app.get("/api/analytics/insight-snapshots/latest",
    withErrorHandling("fetch latest insight snapshot", async (req, res) => {
      const { scope = "fleet", orgId = (req as AuthenticatedRequest).orgId } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const snapshot = await storage.getLatestInsightSnapshot(scope as string, orgId as string);
      if (!snapshot) {
        return sendNotFound(res, "Insight snapshot");
      }
      const { normalizeInsightSnapshot } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeInsightSnapshot(snapshot));
    })
  );
}
