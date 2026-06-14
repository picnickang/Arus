/**
 * Sensor Management Interfaces - Types
 */

import type { RequestHandler } from "express";
import type {
  ISensorEquipmentPort,
  ISensorThresholdOptimizationPort,
  ISensorTelemetryHistoryPort,
} from "../domain/ports";
import type { SensorManagementService } from "../application";

/** External deps supplied by the domain-router registry (incl. cross-domain ports). */
export interface SensorManagementConfig {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
  criticalOperationRateLimit: RequestHandler;
  equipment: ISensorEquipmentPort;
  optimization: ISensorThresholdOptimizationPort;
  telemetryHistory: ISensorTelemetryHistoryPort;
}

/** Internal context passed to each route group: rate limiters + wired service. */
export interface SensorRouteContext {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
  criticalOperationRateLimit: RequestHandler;
  service: SensorManagementService;
}
