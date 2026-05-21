/**
 * Centralized Rate Limiting Configuration
 *
 * Single source of truth for all API rate limits across the application.
 * Prevents duplication and makes it easy to adjust limits globally.
 */

import rateLimit from "express-rate-limit";

// ============================================================================
// RATE LIMIT CONFIGURATIONS
// ============================================================================

/**
 * Resolve a rate-limit ceiling from an optional environment override,
 * falling back to the production default.
 *
 * This exists so load/accuracy testing can raise a specific ceiling via
 * env (e.g. `RATE_LIMIT_TELEMETRY_MAX=10000`) WITHOUT editing committed
 * code — which previously led to testing values shipping to production.
 * The default is always the safe production value.
 */
function maxFromEnv(envVar: string, productionDefault: number): number {
  const raw = process.env[envVar];
  if (!raw) return productionDefault;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return productionDefault;
  return parsed;
}

export const RateLimitConfig = {
  /**
   * Telemetry ingestion - 120 requests/min (2 readings/second per client).
   * For edge devices sending sensor data.
   * Override for load testing via RATE_LIMIT_TELEMETRY_MAX.
   */
  TELEMETRY: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: maxFromEnv("RATE_LIMIT_TELEMETRY_MAX", 120),
    message: {
      error:
        "Too many telemetry requests. Marine equipment should limit data transmission to 2 readings/second maximum.",
      code: "RATE_LIMIT_TELEMETRY",
    },
  },

  /**
   * Bulk import operations - 10 requests/min
   * For CSV/JSON bulk data imports
   */
  BULK_IMPORT: {
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: {
      error:
        "Too many bulk import requests. Bulk telemetry imports are limited to prevent system overload.",
      code: "RATE_LIMIT_BULK_IMPORT",
    },
  },

  /**
   * General API access - 300 requests/min
   * For dashboard and general UI operations
   */
  GENERAL_API: {
    windowMs: 1 * 60 * 1000,
    max: 300,
    message: {
      error: "Too many API requests. Please reduce request frequency.",
      code: "RATE_LIMIT_GENERAL",
    },
  },

  /**
   * Write operations - 60 requests/min.
   * For POST/PUT/PATCH/DELETE operations.
   * Override for load testing via RATE_LIMIT_WRITE_MAX.
   */
  WRITE_OPERATIONS: {
    windowMs: 1 * 60 * 1000,
    max: maxFromEnv("RATE_LIMIT_WRITE_MAX", 60),
    message: {
      error: "Too many write operations. Please slow down data modifications.",
      code: "RATE_LIMIT_WRITE_OPERATIONS",
    },
  },

  /**
   * Critical operations - 20 requests/5min
   * For dangerous operations like factory reset, bulk delete
   */
  CRITICAL_OPERATIONS: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20,
    message: {
      error:
        "Too many critical operations. Critical system operations are heavily rate limited for safety.",
      code: "RATE_LIMIT_CRITICAL_OPERATIONS",
    },
  },

  /**
   * ML Training - 5 requests/hour.
   * For expensive ML model training operations.
   * Override for accuracy testing via RATE_LIMIT_ML_TRAINING_MAX.
   */
  ML_TRAINING: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: maxFromEnv("RATE_LIMIT_ML_TRAINING_MAX", 5),
    message: {
      error: "Too many ML training requests. Model training is computationally expensive.",
      code: "RATE_LIMIT_ML_TRAINING",
    },
  },

  /**
   * Report generation - 20 requests/min
   * For PDF reports and analytics generation
   */
  REPORT_GENERATION: {
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: {
      error: "Too many report generation requests.",
      code: "RATE_LIMIT_REPORTS",
    },
  },
};

// ============================================================================
// RATE LIMITER FACTORY
// ============================================================================

/**
 * Create a rate limiter with consistent configuration
 */
function createRateLimit(config: typeof RateLimitConfig.TELEMETRY) {
  return rateLimit({
    ...config,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip all validations - we're in a controlled Replit environment
    // with a reverse proxy, and we understand the security implications
    validate: false,
    keyGenerator: (req) => {
      // Use req.ip directly without any validation to avoid trust proxy errors
      const ip = req.ip || req.connection?.remoteAddress || "unknown";
      const userAgent = req.get("User-Agent")?.slice(0, 50) || "unknown";
      return `${ip}-${userAgent}`;
    },
  });
}

// ============================================================================
// EXPORTED RATE LIMITERS
// ============================================================================

/**
 * Rate limiter for telemetry ingestion endpoints
 * Apply to: /api/telemetry, /api/edge/telemetry
 */
export const telemetryRateLimit = createRateLimit(RateLimitConfig.TELEMETRY);

/**
 * Rate limiter for bulk import operations
 * Apply to: /api/telemetry/bulk-import, /api/import/*
 */
export const bulkImportRateLimit = createRateLimit(RateLimitConfig.BULK_IMPORT);

/**
 * Rate limiter for general API endpoints
 * Apply to: /api/* (default)
 */
export const generalApiRateLimit = createRateLimit(RateLimitConfig.GENERAL_API);

/**
 * Rate limiter for write operations
 * Apply to: POST/PUT/PATCH/DELETE endpoints
 */
export const writeOperationRateLimit = createRateLimit(RateLimitConfig.WRITE_OPERATIONS);

/**
 * Rate limiter for critical/dangerous operations
 * Apply to: /api/admin/*, /api/system/factory-reset, etc.
 */
export const criticalOperationRateLimit = createRateLimit(RateLimitConfig.CRITICAL_OPERATIONS);

/**
 * Rate limiter for ML training operations
 * Apply to: /api/ml/train/*
 */
export const mlTrainingRateLimit = createRateLimit(RateLimitConfig.ML_TRAINING);

/**
 * Rate limiter for report generation
 * Apply to: /api/reports/*
 */
export const reportGenerationRateLimit = createRateLimit(RateLimitConfig.REPORT_GENERATION);

// ============================================================================
// RATE LIMIT UTILITIES
// ============================================================================

/**
 * Get all rate limit configurations (for monitoring/display)
 */
export function getAllRateLimitConfigs() {
  return {
    telemetry: RateLimitConfig.TELEMETRY,
    bulkImport: RateLimitConfig.BULK_IMPORT,
    generalApi: RateLimitConfig.GENERAL_API,
    writeOperations: RateLimitConfig.WRITE_OPERATIONS,
    criticalOperations: RateLimitConfig.CRITICAL_OPERATIONS,
    mlTraining: RateLimitConfig.ML_TRAINING,
    reportGeneration: RateLimitConfig.REPORT_GENERATION,
  };
}

/**
 * Update rate limit configuration at runtime (for testing/debugging)
 * WARNING: Changes are not persisted and will reset on server restart
 */
export function updateRateLimitConfig(
  type: keyof typeof RateLimitConfig,
  updates: Partial<typeof RateLimitConfig.TELEMETRY>
) {
  Object.assign(RateLimitConfig[type], updates);
}
