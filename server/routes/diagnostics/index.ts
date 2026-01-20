/**
 * Diagnostics Routes - Main Entry Point
 * Re-exports and orchestrates all diagnostics route modules
 */

import { Router } from "express";
import { registerHealthRoutes } from "./health-routes.js";
import { registerMetricsRoutes } from "./metrics-routes.js";
import { registerTestsRoutes } from "./tests-routes.js";
import { registerConfigRoutes } from "./config-routes.js";

export type { HealthCheckResult, CheckResult, ServiceStatus, SystemMetrics, SmokeSuite } from "./types.js";

const router = Router();

registerHealthRoutes(router);
registerMetricsRoutes(router);
registerTestsRoutes(router);
registerConfigRoutes(router);

export default router;
