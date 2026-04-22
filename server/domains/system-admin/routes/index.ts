/**
 * System Admin Routes - Index Aggregator
 * Combines all modular system admin route handlers
 */

import type { Express } from "express";
import type { SystemAdminDependencies, ThresholdCalibrator } from "./types.js";
import { logger } from "../../../utils/logger.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { registerAuditRoutes } from "./audit-routes.js";
import { registerSettingsRoutes } from "./settings-routes.js";
import { registerSimulationRoutes } from "./simulation-routes.js";
import { registerIntegrationsRoutes } from "./integrations-routes.js";
import { registerWindowsRoutes } from "./windows-routes.js";
import { registerMetricsRoutes } from "./metrics-routes.js";

export type { SystemAdminDependencies, ThresholdCalibrator };

export function registerSystemAdminRoutes(app: Express, deps: SystemAdminDependencies): void {
  registerAuthRoutes(app, deps);
  registerAuditRoutes(app, deps);
  registerSettingsRoutes(app, deps);
  registerSimulationRoutes(app, deps);
  registerIntegrationsRoutes(app, deps);
  registerWindowsRoutes(app, deps);
  registerMetricsRoutes(app, deps);

  logger.info(
    "SystemAdminRoutes",
    "Registered (auth: 2, audit: 4, settings: 7, integrations: 7, windows: 7, metrics: 4, simulation: 4)"
  );
}

export {
  registerAuthRoutes,
  registerAuditRoutes,
  registerSettingsRoutes,
  registerSimulationRoutes,
  registerIntegrationsRoutes,
  registerWindowsRoutes,
  registerMetricsRoutes,
};
