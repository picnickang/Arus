/**
 * ML Analytics - Threshold Optimization Routes
 *
 * CRUD operations for threshold optimizations. Data access lives in the
 * application service; this layer only handles HTTP concerns + validation.
 */

import type { Express } from "express";
import { insertThresholdOptimizationSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import { authenticatedRequest } from "../../../middleware/auth";
import { mlAnalyticsService } from "../application/index.js";

export function registerThresholdRoutes(app: Express, config: MlAnalyticsConfig) {
  const { writeOperationRateLimit } = config;

  app.get(
    "/api/analytics/threshold-optimizations",
    withErrorHandling("fetch threshold optimizations", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId, equipmentId, status } = req.query;
      res.json(
        await mlAnalyticsService.listThresholds(
          orgId as string,
          equipmentId as string,
          status as string
        )
      );
    })
  );

  app.get(
    "/api/analytics/threshold-optimizations/:id",
    withErrorHandling("fetch threshold optimization", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId } = req.query;
      const optimization = await mlAnalyticsService.getThreshold(
        Number.parseInt(req.params["id"] ?? ""),
        orgId as string
      );
      if (!optimization) {
        return sendNotFound(res, "Threshold optimization");
      }
      res.json(optimization);
    })
  );

  app.post(
    "/api/analytics/threshold-optimizations",
    writeOperationRateLimit,
    withErrorHandling("create threshold optimization", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId, ...optimizationData } = req.body;
      const validatedData = insertThresholdOptimizationSchema.parse(optimizationData);
      const optimization = await mlAnalyticsService.createThreshold(
        validatedData,
        orgId as string
      );
      res.status(201).json(optimization);
    })
  );

  app.patch(
    "/api/analytics/threshold-optimizations/:id/apply",
    writeOperationRateLimit,
    withErrorHandling("apply threshold optimization", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId } = req.body;
      const optimization = await mlAnalyticsService.applyThreshold(
        Number.parseInt(req.params["id"] ?? ""),
        orgId as string
      );
      res.json(optimization);
    })
  );
}
