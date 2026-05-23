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
  vesselId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface EngineLogFilters {
  vesselId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface EventFilters {
  eventType?: string;
  source?: string;
  startTime?: Date;
  endTime?: Date;
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
