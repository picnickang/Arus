/**
 * Crew Routes - Shared Types
 */

import type { Express } from "express";

export interface RateLimitMiddleware {
  writeOperationRateLimit: any;
  criticalOperationRateLimit: any;
  generalApiRateLimit: any;
}

export interface CrewRouteDeps {
  app: Express;
  rateLimit: RateLimitMiddleware;
}

export function getExpiryUrgencyLevel(expiryDate: Date | string): 'critical' | 'warning' | 'notice' {
  const daysUntilExpiry = Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry <= 0) { return 'critical'; }
  if (daysUntilExpiry <= 30) { return 'critical'; }
  if (daysUntilExpiry <= 60) { return 'warning'; }
  return 'notice';
}
