/**
 * Crew Extensions Routes - Types
 *
 * Interface definitions for crew-extensions route configuration.
 * Re-exports the canonical AuthenticatedRequest from the auth middleware
 * so domain code shares a single source of truth (avoids structural Request
 * conflicts when domains declare their own variant).
 */

import type { RateLimitRequestHandler } from "express-rate-limit";

export type { AuthenticatedRequest } from "../../../middleware/auth";

export interface CrewExtensionsRoutesConfig {
  crewOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
}
