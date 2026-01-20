/**
 * Rate Limit Factory - Centralized rate limiting configuration
 * 
 * SonarQube Fix: Eliminates duplicated keyGenerator functions and magic numbers
 * Previously: 7 rate limiters with identical keyGenerator code blocks
 * Now: Single factory with shared configuration constants
 */

import rateLimit, { type Options as RateLimitOptions } from "express-rate-limit";
import { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/** Rate limit time windows in milliseconds */
export const RATE_LIMIT_WINDOWS = {
  ONE_MINUTE: 60_000,
  FIVE_MINUTES: 300_000,
  FIFTEEN_MINUTES: 900_000,
  ONE_HOUR: 3_600_000,
} as const;

/** Default max requests per window by operation type */
export const RATE_LIMIT_DEFAULTS = {
  GENERAL_API: 300,
  WRITE_OPERATIONS: 60,
  CRITICAL_OPERATIONS: 20,
  TELEMETRY: 600,
  BULK_IMPORT: 10,
  REPORT_GENERATION: 10,
  CREW_OPERATIONS: 30,
  DEVELOPMENT_MULTIPLIER: 10,
} as const;

/** Error codes for rate limit responses */
export const RATE_LIMIT_ERROR_CODES = {
  GENERAL: "RATE_LIMIT_GENERAL",
  WRITE: "RATE_LIMIT_WRITE_OPERATIONS",
  CRITICAL: "RATE_LIMIT_CRITICAL_OPERATIONS",
  TELEMETRY: "RATE_LIMIT_TELEMETRY",
  BULK_IMPORT: "RATE_LIMIT_BULK_IMPORT",
  REPORT: "RATE_LIMIT_REPORT_GENERATION",
  CREW: "RATE_LIMIT_CREW_OPERATIONS",
} as const;

/**
 * Shared key generator that combines IP and User-Agent for better request identification
 * Prevents rate limit bypass by clients with rotating IPs
 */
export function createKeyGenerator(includeUserAgent = true): (req: Request) => string {
  return (req: Request): string => {
    const ip = ipKeyGenerator(req);
    
    if (!includeUserAgent) {
      return ip;
    }
    
    const userAgent = req.get("User-Agent")?.slice(0, 50) || "unknown";
    return `${ip}-${userAgent}`;
  };
}

/**
 * Device-aware key generator for IoT/telemetry endpoints
 * Prioritizes device ID header for embedded systems
 * Uses ipKeyGenerator for proper IPv6 support
 */
export function createDeviceKeyGenerator(): (req: Request) => string {
  return (req: Request): string => {
    const deviceId = req.headers["x-device-id"] as string;
    if (deviceId) {
      return deviceId;
    }
    return ipKeyGenerator(req);
  };
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  code: string;
  useDeviceKey?: boolean;
  skipUserAgent?: boolean;
}

/**
 * Creates a rate limiter with consistent configuration
 * Centralized factory eliminates duplication across 7+ files
 */
export function createRateLimiter(config: RateLimitConfig) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isEmbedded = process.env.EMBEDDED_MODE === "true";
  const relaxLimits = isDevelopment || isEmbedded;
  
  const effectiveMax = relaxLimits 
    ? config.max * RATE_LIMIT_DEFAULTS.DEVELOPMENT_MULTIPLIER 
    : config.max;

  const options: Partial<RateLimitOptions> = {
    windowMs: config.windowMs,
    max: effectiveMax,
    message: {
      error: config.message,
      code: config.code,
    },
    standardHeaders: true,
    legacyHeaders: false,
  };

  if (config.useDeviceKey) {
    options.keyGenerator = createDeviceKeyGenerator();
  } else {
    options.keyGenerator = createKeyGenerator(!config.skipUserAgent);
  }

  return rateLimit(options);
}

/** Pre-configured rate limiters for common use cases */
export const RateLimiters = {
  general: () => createRateLimiter({
    windowMs: RATE_LIMIT_WINDOWS.ONE_MINUTE,
    max: RATE_LIMIT_DEFAULTS.GENERAL_API,
    message: "Too many API requests. Please reduce request frequency.",
    code: RATE_LIMIT_ERROR_CODES.GENERAL,
  }),

  write: () => createRateLimiter({
    windowMs: RATE_LIMIT_WINDOWS.ONE_MINUTE,
    max: RATE_LIMIT_DEFAULTS.WRITE_OPERATIONS,
    message: "Too many write operations. Please slow down data modifications.",
    code: RATE_LIMIT_ERROR_CODES.WRITE,
  }),

  critical: () => createRateLimiter({
    windowMs: RATE_LIMIT_WINDOWS.FIVE_MINUTES,
    max: RATE_LIMIT_DEFAULTS.CRITICAL_OPERATIONS,
    message: "Too many critical operations. Critical system operations are heavily rate limited for safety.",
    code: RATE_LIMIT_ERROR_CODES.CRITICAL,
  }),

  telemetry: () => createRateLimiter({
    windowMs: RATE_LIMIT_WINDOWS.ONE_MINUTE,
    max: RATE_LIMIT_DEFAULTS.TELEMETRY,
    message: "Too many telemetry requests. Marine equipment should limit data transmission to 10 readings per second maximum.",
    code: RATE_LIMIT_ERROR_CODES.TELEMETRY,
    useDeviceKey: true,
  }),

  bulkImport: () => createRateLimiter({
    windowMs: RATE_LIMIT_WINDOWS.FIVE_MINUTES,
    max: RATE_LIMIT_DEFAULTS.BULK_IMPORT,
    message: "Too many bulk import requests. Bulk telemetry imports are limited to prevent system overload.",
    code: RATE_LIMIT_ERROR_CODES.BULK_IMPORT,
  }),

  report: () => createRateLimiter({
    windowMs: RATE_LIMIT_WINDOWS.FIVE_MINUTES,
    max: RATE_LIMIT_DEFAULTS.REPORT_GENERATION,
    message: "Too many report generation requests. AI-powered reports are limited to prevent resource exhaustion.",
    code: RATE_LIMIT_ERROR_CODES.REPORT,
  }),

  crew: () => createRateLimiter({
    windowMs: RATE_LIMIT_WINDOWS.ONE_MINUTE,
    max: RATE_LIMIT_DEFAULTS.CREW_OPERATIONS,
    message: "Too many crew operations. Please slow down crew management activities.",
    code: RATE_LIMIT_ERROR_CODES.CREW,
  }),
} as const;
