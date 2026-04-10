/**
 * Crew Extensions Routes - Types
 * Interface definitions for route configuration
 */

import type { Request } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";

export interface AuthenticatedRequest extends Request {
  orgId?: string;
}

export interface CrewExtensionsRoutesConfig {
  crewOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
}
