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
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Routes:Analytics:Index");

export function mountAnalyticsRoutes(app: Express) {
  const router = Router();
  mountHealthMetricsRoutes(router);
  mountPredictionsRoutes(router);
  mountModelGovernanceRoutes(router);
  mountCostsAndFeedbackRoutes(router);
  mountCacheReconciliationRoutes(router);
  app.use("/api/analytics", router);
  logger.info("[Analytics Routes] Mounted with Redis caching support");
  logger.info("[Analytics Routes] Data reconciliation endpoints registered");
  if (cacheConfig.analyticsEnabled) {
    logger.info("[Analytics Routes] Redis caching ENABLED (5min default TTL)");
  } else {
    logger.info("[Analytics Routes] Redis caching DISABLED (direct queries)");
  }
}

export {
  getOrgId,
  sendValidatedResponse,
  handleError,
  toFailurePredictionUuid,
} from "./helpers.js";
