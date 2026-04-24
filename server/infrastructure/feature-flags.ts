import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Infrastructure:FeatureFlags");
/**
 * Feature Flags for Tenant-Scoped Repository Migration
 *
 * Allows gradual rollout of ADR 001 implementation with safe rollback.
 * Each domain can be migrated independently with real-time monitoring.
 */

export interface FeatureFlags {
  // Tenant-scoped repository rollout flags
  useTenantScopedEquipment: boolean;
  useTenantScopedWorkOrders: boolean;
  useTenantScopedCrew: boolean;
  useTenantScopedInventory: boolean;
  useTenantScopedAnalytics: boolean;

  // Safety flags
  enableTenantIsolationLogging: boolean;
  enableTenantIsolationMetrics: boolean;
  strictTenantValidation: boolean; // Throw on isolation violations vs log

  // Scheduling system flags (SmartPAL-style overhaul)
  newSchedulerEnabled: boolean; // Master toggle for new scheduling UI
  enableSchedulingTelemetry: boolean; // Log scheduling operations for comparison
  enableSchedulingSettings: boolean; // Enable admin scheduling settings UI
  enableAiSuggestions: boolean; // Enable AI-powered crew suggestions
  enableScheduleGenerator: boolean; // Enable Schedule Generator (AI-powered auto-scheduling)
}

class FeatureFlagManager {
  private flags: FeatureFlags;

  constructor() {
    // Initialize from environment variables
    this.flags = {
      // Domain migration flags (default: true for equipment after Phase 2B completion)
      useTenantScopedEquipment: this.parseEnvFlag("USE_TENANT_SCOPED_EQUIPMENT", true),
      useTenantScopedWorkOrders: this.parseEnvFlag("USE_TENANT_SCOPED_WORK_ORDERS", false),
      useTenantScopedCrew: this.parseEnvFlag("USE_TENANT_SCOPED_CREW", false),
      useTenantScopedInventory: this.parseEnvFlag("USE_TENANT_SCOPED_INVENTORY", false),
      useTenantScopedAnalytics: this.parseEnvFlag("USE_TENANT_SCOPED_ANALYTICS", false),

      // Safety flags (default: true for observability)
      enableTenantIsolationLogging: this.parseEnvFlag("ENABLE_TENANT_ISOLATION_LOGGING", true),
      enableTenantIsolationMetrics: this.parseEnvFlag("ENABLE_TENANT_ISOLATION_METRICS", true),
      strictTenantValidation: this.parseEnvFlag("STRICT_TENANT_VALIDATION", false),

      // Scheduling system flags (SmartPAL-style overhaul)
      newSchedulerEnabled: this.parseEnvFlag("NEW_SCHEDULER_ENABLED", false),
      enableSchedulingTelemetry: this.parseEnvFlag("ENABLE_SCHEDULING_TELEMETRY", true),
      enableSchedulingSettings: this.parseEnvFlag("ENABLE_SCHEDULING_SETTINGS", false),
      enableAiSuggestions: this.parseEnvFlag("ENABLE_AI_SUGGESTIONS", false),
      enableScheduleGenerator: this.parseEnvFlag("ENABLE_SCHEDULE_GENERATOR", false),
    };
  }

  /**
   * Parse boolean environment variable
   */
  private parseEnvFlag(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) {
      return defaultValue;
    }
    return value === "true" || value === "1";
  }

  /**
   * Get all feature flags
   */
  public getFlags(): Readonly<FeatureFlags> {
    return { ...this.flags };
  }

  /**
   * Check if a specific flag is enabled
   */
  public isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag];
  }

  /**
   * Enable a flag at runtime (for testing)
   */
  public enable(flag: keyof FeatureFlags): void {
    this.flags[flag] = true;
  }

  /**
   * Disable a flag at runtime (for rollback)
   */
  public disable(flag: keyof FeatureFlags): void {
    this.flags[flag] = false;
  }

  /**
   * Get migration progress percentage
   */
  public getMigrationProgress(): number {
    const migrationFlags: (keyof FeatureFlags)[] = [
      "useTenantScopedEquipment",
      "useTenantScopedWorkOrders",
      "useTenantScopedCrew",
      "useTenantScopedInventory",
      "useTenantScopedAnalytics",
    ];

    const enabledCount = migrationFlags.filter((flag) => this.flags[flag]).length;
    return (enabledCount / migrationFlags.length) * 100;
  }
}

/**
 * Global feature flag instance
 */
export const featureFlags = new FeatureFlagManager();

/**
 * Tenant isolation event logger
 * Tracks all tenant boundary crossings for audit
 */
export class TenantIsolationLogger {
  /**
   * Log successful tenant isolation enforcement
   */
  static logSuccess(context: {
    domain: string;
    operation: string;
    orgId: string;
    resourceId?: string;
  }): void {
    if (!featureFlags.isEnabled("enableTenantIsolationLogging")) {
      return;
    }

    logger.info("[TENANT_ISOLATION_SUCCESS]", {
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  /**
   * Log tenant isolation violation attempt
   */
  static logViolation(context: {
    domain: string;
    operation: string;
    requestedOrgId: string;
    actualOrgId: string;
    resourceId?: string;
    userId?: string;
  }): void {
    if (!featureFlags.isEnabled("enableTenantIsolationLogging")) {
      return;
    }

    logger.error("[TENANT_ISOLATION_VIOLATION]", undefined, {
      timestamp: new Date().toISOString(),
      severity: "CRITICAL",
      ...context,
    });

    // In strict mode, also throw an error
    if (featureFlags.isEnabled("strictTenantValidation")) {
      throw new Error(
        `Tenant isolation violation: User from org ${context.requestedOrgId} ` +
          `attempted to access resource from org ${context.actualOrgId}`
      );
    }
  }

  /**
   * Log migration fallback (when new pattern fails, falls back to legacy)
   */
  static logFallback(context: {
    domain: string;
    operation: string;
    orgId: string;
    error: string;
  }): void {
    if (!featureFlags.isEnabled("enableTenantIsolationLogging")) {
      return;
    }

    logger.warn("[TENANT_MIGRATION_FALLBACK]", {
      timestamp: new Date().toISOString(),
      ...context,
    });
  }
}

/**
 * Tenant isolation metrics collector
 * Tracks performance and reliability of tenant-scoped repositories
 */
export class TenantIsolationMetrics {
  private static counters = new Map<string, number>();

  /**
   * Increment a metric counter
   */
  static increment(metric: string, labels?: Record<string, string>): void {
    if (!featureFlags.isEnabled("enableTenantIsolationMetrics")) {
      return;
    }

    const key = labels
      ? `${metric}:${Object.entries(labels)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : metric;

    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + 1);
  }

  /**
   * Track repository operation timing
   */
  static async trackOperation<T>(
    domain: string,
    operation: string,
    orgId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!featureFlags.isEnabled("enableTenantIsolationMetrics")) {
      return fn();
    }

    const startTime = Date.now();
    let success = false;

    try {
      const result = await fn();
      success = true;
      return result;
    } finally {
      const duration = Date.now() - startTime;

      this.increment("tenant_repository_operations", {
        domain,
        operation,
        status: success ? "success" : "error",
      });

      logger.debug("[TENANT_METRICS]", { details: {
        domain,
        operation,
        orgId,
        duration,
        success,
      } });
    }
  }

  /**
   * Get all metrics
   */
  static getMetrics(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  /**
   * Reset all metrics (for testing)
   */
  static reset(): void {
    this.counters.clear();
  }
}
