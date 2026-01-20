/**
 * Sensor Management Routes - Main Entry Point
 * Re-exports and orchestrates all sensor management route modules
 */

import type { Express } from "express";
import type { SensorManagementConfig } from "./types.js";
import { registerTelemetryRoutes } from "./telemetry-routes.js";
import { registerSensorConfigRoutes } from "./sensor-config-routes.js";
import { registerSensorStatusRoutes } from "./sensor-status-routes.js";
import { registerSensorOptimizationRoutes } from "./sensor-optimization-routes.js";
import { registerJ1939Routes } from "./j1939-routes.js";
import { logger } from "../../../utils/logger.js";

export type { SensorManagementConfig } from "./types.js";

export function registerSensorManagementRoutes(app: Express, config: SensorManagementConfig) {
  registerTelemetryRoutes(app, config);
  registerSensorConfigRoutes(app, config);
  registerSensorStatusRoutes(app, config);
  registerSensorOptimizationRoutes(app, config);
  registerJ1939Routes(app, config);
  logger.info("SensorManagementRoutes", "Registered (configs, tuning, optimization, J1939, states)");
}
