/**
 * ML Analytics Domain Routes - Main Entry Point
 *
 * Orchestrates registration of all ML analytics route modules.
 */

import type { Express } from "express";
import type { MlAnalyticsConfig } from "./types.js";
import { registerExportCompleteRoutes } from "./export-complete.js";
import { registerExportPartialRoutes } from "./export-partial.js";
import { registerAnomalyRoutes } from "./anomaly-routes.js";
import { registerPredictionRoutes } from "./prediction-routes.js";
import { registerThresholdRoutes } from "./threshold-routes.js";
import { registerTwinRoutes } from "./twin-routes.js";
import { registerInsightRoutes } from "./insight-routes.js";
import { logger } from "../../../utils/logger.js";

export type { MlAnalyticsConfig } from "./types.js";

export function registerMlAnalyticsRoutes(app: Express, config: MlAnalyticsConfig) {
  registerExportCompleteRoutes(app, config);
  registerExportPartialRoutes(app, config);
  registerAnomalyRoutes(app, config);
  registerPredictionRoutes(app, config);
  registerThresholdRoutes(app, config);
  registerTwinRoutes(app, config);
  registerInsightRoutes(app, config);

  logger.info(
    "MlAnalyticsRoutes",
    "Registered (exports: 4, anomalies: 4, predictions: 3, thresholds: 4, twins: 4, insights: 2)"
  );
}
