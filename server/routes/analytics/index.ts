/**
 * Analytics Routes - Modularized Entry Point
 */
import { Router, type Express } from "express";
import { cacheConfig } from "../../lib/cache";
import { mountHealthMetricsRoutes } from "./health-metrics.js";
import { mountPredictionsRoutes } from "./predictions.js";
import { mountModelGovernanceRoutes } from "./model-governance.js";
import { mountCostsAndFeedbackRoutes } from "./costs-and-feedback.js";
import { mountCacheReconciliationRoutes } from "./cache-reconciliation.js";

export function mountAnalyticsRoutes(app: Express) {
  const router = Router();
  mountHealthMetricsRoutes(router);
  mountPredictionsRoutes(router);
  mountModelGovernanceRoutes(router);
  mountCostsAndFeedbackRoutes(router);
  mountCacheReconciliationRoutes(router);
  app.use("/api/analytics", router);
  console.log("[Analytics Routes] Mounted with Redis caching support");
  console.log("[Analytics Routes] Data reconciliation endpoints registered");
  if (cacheConfig.analyticsEnabled) { console.log("[Analytics Routes] Redis caching ENABLED (5min default TTL)"); }
  else { console.log("[Analytics Routes] Redis caching DISABLED (direct queries)"); }
}

export { getOrgId, sendValidatedResponse, handleError, toFailurePredictionUuid } from "./helpers.js";
