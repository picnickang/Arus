/**
 * Rate Limiting Middleware
 * 
 * SonarQube Fix: Removed duplicated keyGenerator functions (5 instances)
 * Now uses centralized rate-limit-factory for consistency
 */

import { RateLimiters } from "../lib/rate-limit-factory";

export const telemetryRateLimit = RateLimiters.telemetry();
export const bulkImportRateLimit = RateLimiters.bulkImport();
export const generalApiRateLimit = RateLimiters.general();
export const writeOperationRateLimit = RateLimiters.write();
export const criticalOperationRateLimit = RateLimiters.critical();
export const crewOperationRateLimit = RateLimiters.crew();
export const reportGenerationRateLimit = RateLimiters.report();
