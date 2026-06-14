/**
 * Sensor Management Routes - Aggregator
 *
 * Constructs the application service (sensor repository + injected cross-domain
 * ports) and registers all sensor-management route groups.
 */

import type { Express } from "express";
import { SensorManagementService } from "../application";
import { sensorRepository } from "../infrastructure";
import { logger } from "../../../utils/logger.js";
import type { SensorManagementConfig, SensorRouteContext } from "./types.js";
import { registerSensorConfigRoutes } from "./sensor-config-routes.js";
import { registerSensorStatusRoutes } from "./sensor-status-routes.js";
import { registerSensorOptimizationRoutes } from "./sensor-optimization-routes.js";
import { registerJ1939Routes } from "./j1939-routes.js";
import { registerTelemetryRoutes } from "./telemetry-routes.js";

export type { SensorManagementConfig } from "./types.js";

export function registerSensorManagementRoutes(app: Express, config: SensorManagementConfig) {
  const service = new SensorManagementService(
    sensorRepository,
    config.equipment,
    config.optimization,
    config.telemetryHistory
  );
  const ctx: SensorRouteContext = {
    requireOrgId: config.requireOrgId,
    generalApiRateLimit: config.generalApiRateLimit,
    writeOperationRateLimit: config.writeOperationRateLimit,
    criticalOperationRateLimit: config.criticalOperationRateLimit,
    service,
  };

  registerTelemetryRoutes(app, ctx);
  registerSensorConfigRoutes(app, ctx);
  registerSensorStatusRoutes(app, ctx);
  registerSensorOptimizationRoutes(app, ctx);
  registerJ1939Routes(app, ctx);
  logger.info("SensorManagementRoutes", "Registered (configs, tuning, optimization, J1939, states)");
}
