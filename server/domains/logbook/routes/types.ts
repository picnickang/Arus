/**
 * Logbook Routes - Shared Types
 *
 * Common types and interfaces for logbook route handlers.
 */

import type { RequestHandler } from "express";

export interface RateLimiters {
  writeOperationRateLimit: RequestHandler;
  criticalOperationRateLimit: RequestHandler;
  generalApiRateLimit: RequestHandler;
}

export interface DeckLogFilters {
  vesselId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  status?: string | undefined;
}

export interface EngineLogFilters {
  vesselId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  status?: string | undefined;
}

export interface EventFilters {
  eventType?: string | undefined;
  source?: string | undefined;
  startTime?: Date | undefined;
  endTime?: Date | undefined;
}

export interface SignatureDetails {
  signedByCrewId: string;
  signedByName: string;
  signedByRank: string;
}

export interface LockDetails {
  lockedByUserId: string;
  lockedByUserName: string;
}
