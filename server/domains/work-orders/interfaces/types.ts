/**
 * Work Orders Routes Types
 *
 * Shared types for work order route handlers.
 */

import type { Express, RequestHandler } from "express";

export interface RateLimitMiddleware {
  writeOperationRateLimit: RequestHandler;
  criticalOperationRateLimit: RequestHandler;
  generalApiRateLimit: RequestHandler;
}

export type RouteRegistrar = (app: Express, rateLimit: RateLimitMiddleware) => void;
