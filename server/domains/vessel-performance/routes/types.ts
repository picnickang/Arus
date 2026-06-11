/**
 * Vessel Performance Routes - Shared Types
 *
 * Re-exports the canonical AuthenticatedRequest from the auth middleware
 * so domain route modules share a single Request shape.
 */

import type { Express, Request, Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";

export type { AuthenticatedRequest } from "../../../middleware/auth";

export interface VesselPerformanceRoutesConfig {
  crewOperationRateLimit: RateLimitRequestHandler;
}

export type RouteRegisterFn = (app: Express, config: VesselPerformanceRoutesConfig) => void;

export type { Request, Response };
