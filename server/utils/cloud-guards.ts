// @ts-nocheck
/**
 * Cloud Mode Guards and Utilities
 *
 * Provides centralized helpers for gating cloud-only features and preventing
 * crashes when accessing PostgreSQL-only tables in vessel/SQLite mode.
 *
 * Created: November 23, 2025 (STAGE 3 Schema Compatibility Fix)
 */

import { isCloudMode, canUseCloudFeature } from "../config/runtimeEnv";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Utils:CloudGuards");

/**
 * Assert that we're running in cloud mode, throw if in vessel mode
 *
 * Use this at the start of cloud-only service methods to fail fast
 * with a clear error message instead of cryptic undefined crashes.
 *
 * @param featureName - Human-readable feature name for error message
 * @throws Error if not in cloud mode
 *
 * @example
 * async function startAuditService() {
 *   assertCloudMode('Audit Service');
 *   // ... cloud-only audit logic
 * }
 */
export function assertCloudMode(featureName: string): void {
  if (!isCloudMode) {
    throw new Error(
      `${featureName} is a cloud-only feature and is not available in vessel/embedded mode. ` +
        `Current mode: VESSEL. This feature requires PostgreSQL database.`
    );
  }
}

/**
 * Get a cloud-only table with runtime safety check
 *
 * Use this when accessing PostgreSQL-only tables that are exported as
 * `undefined` in SQLite mode. Prevents "Cannot read property 'from' of undefined" crashes.
 *
 * @param table - Table object (may be undefined in vessel mode)
 * @param featureName - Human-readable feature name for error message
 * @returns The table object if in cloud mode and table exists
 * @throws Error if not in cloud mode or table is undefined
 *
 * @example
 * const adminSessionsTable = getCloudTable(adminSessions, 'Admin Sessions');
 * await db.select().from(adminSessionsTable); // Safe!
 */
export function getCloudTable<T>(table: T | undefined, featureName: string): T {
  assertCloudMode(featureName);

  if (!table) {
    throw new Error(
      `Cloud-only table for ${featureName} is not available. ` +
        `This table does not exist in SQLite vessel schema.`
    );
  }

  return table;
}

/**
 * Check if a cloud feature is available (non-throwing)
 *
 * Use this for conditional logic where you want to gracefully skip
 * cloud-only features instead of throwing an error.
 *
 * @param featureName - Feature name to check
 * @returns true if in cloud mode and feature is available
 *
 * @example
 * if (isCloudFeatureAvailable('webhooks')) {
 *   await sendWebhook(...);
 * } else {
 *   logger.info('Webhooks not available in vessel mode, skipping');
 * }
 */
export function isCloudFeatureAvailable(featureName: string): boolean {
  return isCloudMode && canUseCloudFeature(featureName);
}

/**
 * Conditional cloud-only execution wrapper
 *
 * Execute a function only in cloud mode, otherwise skip silently.
 * Useful for optional cloud-only side effects in shared code paths.
 *
 * @param fn - Function to execute (should be async)
 * @param featureName - Feature name for logging
 *
 * @example
 * await executeInCloudMode(async () => {
 *   await logAuditEvent(...);
 * }, 'Audit Logging');
 * // Logs "Audit Logging skipped (vessel mode)" if in vessel mode
 */
export async function executeInCloudMode(
  fn: () => Promise<void>,
  featureName: string
): Promise<void> {
  if (!isCloudMode) {
    logger.info(`[Cloud Guard] ${featureName} skipped (vessel mode)`);
    return;
  }

  try {
    await fn();
  } catch (error) {
    logger.error(`[Cloud Guard] ${featureName} failed:`, undefined, error);
    throw error;
  }
}

/**
 * Type-safe cloud table accessor with fallback
 *
 * Similar to getCloudTable but returns undefined in vessel mode instead of throwing.
 * Use this when you want to handle the vessel case yourself.
 *
 * @param table - Table object (may be undefined in vessel mode)
 * @returns The table object if in cloud mode, undefined otherwise
 */
export function getCloudTableOrUndefined<T>(table: T | undefined): T | undefined {
  if (!isCloudMode) {
    return undefined;
  }
  return table;
}
