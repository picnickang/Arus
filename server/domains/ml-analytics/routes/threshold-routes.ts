/**
 * ML Analytics - Threshold Optimization Routes
 * 
 * CRUD operations for threshold optimizations.
 */

import type { Express } from "express";
import { insertThresholdOptimizationSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerThresholdRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage, writeOperationRateLimit } = config;

  app.get("/api/analytics/threshold-optimizations",
    withErrorHandling("fetch threshold optimizations", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, equipmentId, status } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const optimizations = await storage.getThresholdOptimizations(
        orgId as string,
        equipmentId as string,
        status as string
      );
      const { normalizeThresholdOptimizations } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeThresholdOptimizations(optimizations));
    })
  );

  app.get("/api/analytics/threshold-optimizations/:id",
    withErrorHandling("fetch threshold optimization", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const optimization = await storage.getThresholdOptimization(Number.parseInt(req.params.id), orgId as string);
      if (!optimization) {
        return sendNotFound(res, "Threshold optimization");
      }
      const { normalizeThresholdOptimization } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeThresholdOptimization(optimization));
    })
  );

  app.post("/api/analytics/threshold-optimizations", writeOperationRateLimit,
    withErrorHandling("create threshold optimization", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, ...optimizationData } = req.body;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const validatedData = insertThresholdOptimizationSchema.parse(optimizationData);
      const optimization = await storage.createThresholdOptimization(validatedData, orgId);
      const { normalizeThresholdOptimization } = await import("../../../analytics-data-normalizer.js");
      res.status(201).json(normalizeThresholdOptimization(optimization));
    })
  );

  app.patch("/api/analytics/threshold-optimizations/:id/apply", writeOperationRateLimit,
    withErrorHandling("apply threshold optimization", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.body;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const optimization = await storage.applyThresholdOptimization(Number.parseInt(req.params.id), orgId);
      const { normalizeThresholdOptimization } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeThresholdOptimization(optimization));
    })
  );
}
