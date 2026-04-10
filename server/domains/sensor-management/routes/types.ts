/**
 * Sensor Management Routes - Types
 * Interface definitions for route configuration
 */

import type { RequestHandler } from "express";

export interface SensorManagementConfig {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
  criticalOperationRateLimit: RequestHandler;
}
