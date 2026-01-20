/**
 * Work Orders Routes Types
 *
 * Shared types for work order route handlers.
 */

import type { Express } from "express";

export interface RateLimitMiddleware {
  writeOperationRateLimit: any;
  criticalOperationRateLimit: any;
  generalApiRateLimit: any;
}

export type RouteRegistrar = (app: Express, rateLimit: RateLimitMiddleware) => void;
