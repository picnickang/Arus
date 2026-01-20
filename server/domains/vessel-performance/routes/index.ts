/**
 * Vessel Performance Routes - Modular Registration
 */

import type { Express } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import { registerVPSRoutes } from "./vps-routes.js";
import { registerCIIRoutes } from "./cii-routes.js";
import { registerModeRoutes } from "./mode-routes.js";
import { registerNarrativeRoutes } from "./narrative-routes.js";
import { registerSchedulingRoutes } from "./scheduling-routes.js";
import { logger } from "../../../utils/logger.js";

export type { VesselPerformanceRoutesConfig } from "./types.js";

export function registerVesselPerformanceRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {
  logger.info("VesselPerformanceRoutes", "Registering VPS API endpoints");

  registerVPSRoutes(app, config);
  registerCIIRoutes(app, config);
  registerModeRoutes(app, config);
  registerNarrativeRoutes(app, config);
  registerSchedulingRoutes(app, config);

  logger.info("VesselPerformanceRoutes", "Registered (vps: 2, cii: 2, mode: 1, narrative: 1, enhanced-scheduling: 1)");
}
