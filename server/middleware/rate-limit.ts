/**
 * Rate Limiting Middleware
 * Protects write endpoints from abuse
 * 
 * SonarQube Fix: Uses centralized factory instead of duplicated config
 */

import { 
  createRateLimiter, 
  RATE_LIMIT_WINDOWS, 
  RATE_LIMIT_DEFAULTS,
  RATE_LIMIT_ERROR_CODES,
} from "../lib/rate-limit-factory";

export const writeLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_WINDOWS.ONE_MINUTE,
  max: RATE_LIMIT_DEFAULTS.WRITE_OPERATIONS,
  message: "Too many requests, please try again later.",
  code: RATE_LIMIT_ERROR_CODES.WRITE,
  useDeviceKey: true,
});

export const telemetryLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_WINDOWS.ONE_MINUTE,
  max: RATE_LIMIT_DEFAULTS.TELEMETRY,
  message: "Telemetry rate limit exceeded.",
  code: RATE_LIMIT_ERROR_CODES.TELEMETRY,
  useDeviceKey: true,
});

export const bulkLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_WINDOWS.FIVE_MINUTES,
  max: RATE_LIMIT_DEFAULTS.BULK_IMPORT,
  message: "Bulk operation rate limit exceeded.",
  code: RATE_LIMIT_ERROR_CODES.BULK_IMPORT,
});
