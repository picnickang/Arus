import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Config:RuntimeEnv");
/**
 * Centralized Runtime Environment Configuration
 *
 * Determines deployment mode and provides environment-aware feature flags.
 * This module is the single source of truth for:
 * - Deployment mode detection (VESSEL vs CLOUD)
 * - Database availability (SQLite vs PostgreSQL/libSQL)
 * - Feature availability based on deployment mode
 */

// ============================================================================
// DEPLOYMENT MODE DETECTION
// ============================================================================

/**
 * Detect if running in LOCAL/EMBEDDED mode (vessel/desktop deployment)
 * Checks environment variables set by Tauri or vessel configuration
 *
 * IMPORTANT: This module is PURE (no side effects). The auto-fallback logic
 * for EMBEDDED_MODE is handled by db-config.ts BEFORE importing this module.
 * This ensures proper initialization order and prevents repeated side effects.
 */
export const isLocalMode =
  process.env["LOCAL_MODE"] === "true" ||
  process.env["EMBEDDED_MODE"] === "true" ||
  process.env["DEPLOYMENT_MODE"] === "VESSEL";

/**
 * Detect if running in VESSEL mode specifically (offline-first vessel deployment)
 */
export const isVesselMode =
  process.env["DEPLOYMENT_MODE"] === "VESSEL" || process.env["EMBEDDED_MODE"] === "true";

/**
 * Detect if running in CLOUD mode (server deployment with PostgreSQL/libSQL)
 */
export const isCloudMode = !isLocalMode;

/**
 * Deployment mode string for logging and diagnostics
 */
export const deploymentMode: "VESSEL" | "CLOUD" = isVesselMode ? "VESSEL" : "CLOUD";

// ============================================================================
// DATABASE AVAILABILITY
// ============================================================================

/**
 * Check if cloud database (PostgreSQL/libSQL/Turso) is available
 * Based on presence of DATABASE_URL environment variable
 */
export const canUseCloudDb = !!(
  process.env["DATABASE_URL"] ||
  process.env["TURSO_DB_URL"] ||
  process.env["NEON_DATABASE_URL"]
);

/**
 * Check if embedded SQLite database should be used
 * True in vessel/local mode OR when cloud DB is not available
 */
export const canUseEmbeddedDb = isLocalMode || !canUseCloudDb;

/**
 * Check if PostgreSQL-specific features are available
 * (TimescaleDB, materialized views, full-text search, etc.)
 */
export const hasPostgresFeatures = canUseCloudDb && isCloudMode;

/**
 * Check if libSQL-specific features are available (db.execute, etc.)
 * Only true when using Turso/libSQL client
 */
export const hasLibSQLFeatures = !!(process.env["TURSO_DB_URL"] && process.env["TURSO_AUTH_TOKEN"]);

// ============================================================================
// FEATURE FLAGS BASED ON DEPLOYMENT MODE
// ============================================================================

/**
 * Features that should ONLY run in CLOUD mode
 */
export const cloudOnlyFeatures = {
  /** Connection pool health monitoring (requires db.execute) */
  connectionPoolHealthCheck: hasLibSQLFeatures && isCloudMode,

  /** TimescaleDB optimizations (compression, retention policies) */
  timescaleDbOptimization: hasPostgresFeatures,

  /** Materialized view refresh scheduling */
  materializedViewScheduler: hasPostgresFeatures,

  /** Vector similarity search (pgvector) */
  vectorSearch: hasPostgresFeatures,

  /** Update scheduler (software patches) */
  updateScheduler: isCloudMode,

  /** Sync manager (vessel → cloud synchronization) */
  syncManager: isCloudMode,

  /** Telemetry pruning service (large-scale data cleanup) */
  telemetryPruning: hasPostgresFeatures,

  /** Scheduled reports with email delivery */
  scheduledReports: isCloudMode,
};

/**
 * Features that should ONLY run in VESSEL mode
 */
export const vesselOnlyFeatures = {
  /** Offline-first data buffering */
  offlineBuffering: isVesselMode,

  /** Local MQTT broker for equipment telemetry */
  localMqttBroker: isVesselMode,

  /** Vessel-specific sync conflict resolution */
  syncConflictResolution: isVesselMode,
};

/**
 * Features available in BOTH modes
 */
export const sharedFeatures = {
  /** Equipment health monitoring */
  equipmentHealthMonitoring: true,

  /** Maintenance scheduling */
  maintenanceScheduling: true,

  /** Real-time WebSocket updates */
  websocketUpdates: true,

  /** AI-powered insights */
  aiInsights: true,
};

// ============================================================================
// LOGGING HELPER
// ============================================================================

/**
 * Log deployment mode configuration on startup
 */
export function logDeploymentConfig(): void {
  logger.info("=== Deployment Mode Configuration ===");
  logger.info(`Mode: ${deploymentMode}`);
  logger.info(`Local Mode: ${isLocalMode}`);
  logger.info(`Vessel Mode: ${isVesselMode}`);
  logger.info(`Cloud Mode: ${isCloudMode}`);
  logger.info(`Cloud DB Available: ${canUseCloudDb}`);
  logger.info(`Embedded DB Available: ${canUseEmbeddedDb}`);
  logger.info(`PostgreSQL Features: ${hasPostgresFeatures}`);
  logger.info(`libSQL Features: ${hasLibSQLFeatures}`);
  logger.info("=====================================");
}

// ============================================================================
// GUARDS FOR CLOUD-ONLY OPERATIONS
// ============================================================================

/**
 * Guard function for cloud-only operations
 * Throws error if called in vessel mode
 */
export function requireCloudMode(operation: string): void {
  if (!isCloudMode) {
    throw new Error(
      `Operation "${operation}" requires CLOUD mode but running in ${deploymentMode} mode`
    );
  }
}

/**
 * Guard function for PostgreSQL-only operations
 * Throws error if PostgreSQL features not available
 */
export function requirePostgres(operation: string): void {
  if (!hasPostgresFeatures) {
    throw new Error(
      `Operation "${operation}" requires PostgreSQL but not available in ${deploymentMode} mode`
    );
  }
}

/**
 * Guard function for libSQL-only operations (db.execute)
 * Throws error if libSQL not available
 */
export function requireLibSQL(operation: string): void {
  if (!hasLibSQLFeatures) {
    throw new Error(
      `Operation "${operation}" requires libSQL but not available in ${deploymentMode} mode`
    );
  }
}

/**
 * Safe guard for optional cloud features
 * Returns false if feature not available, doesn't throw
 */
export function canUseCloudFeature(featureName: keyof typeof cloudOnlyFeatures): boolean {
  return cloudOnlyFeatures[featureName] === true;
}
