/**
 * Vessel Performance Routes - Shared Types
 */

import type { Express, Request, Response } from "express";
import type { IStorage } from "../../../storage";
import type { RateLimitRequestHandler } from "express-rate-limit";

export interface AuthenticatedRequest extends Request {
  orgId?: string;
}

export interface VesselPerformanceRoutesConfig {
  storage: IStorage;
  crewOperationRateLimit: RateLimitRequestHandler;
}

export type RouteRegisterFn = (app: Express, config: VesselPerformanceRoutesConfig) => void;

export { Request, Response };
