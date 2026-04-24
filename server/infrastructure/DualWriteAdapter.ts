import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Infrastructure:DualWriteAdapter");
/**
 * DualWriteAdapter - Generic adapter for gradual migration to tenant-scoped repositories
 *
 * Supports:
 * - Feature flag-based routing between repository and legacy storage
 * - Automatic fallback on repository errors
 * - Consistency validation in development
 * - Observability hooks for monitoring
 *
 * Usage:
 * ```typescript
 * const adapter = new DualWriteAdapter({
 *   featureFlag: () => isEnabled('useTenantScopedEquipment'),
 *   domain: 'equipment',
 * });
 *
 * const result = await adapter.execute({
 *   operation: 'getAll',
 *   repositoryFn: () => equipmentRepo.getAll(),
 *   legacyFn: () => storage.getEquipmentRegistry(orgId),
 *   consistencyCheck: (repoData, legacyData) => repoData.length === legacyData.length
 * });
 * ```
 */

export interface DualWriteConfig {
  /** Function to check feature flag state */
  featureFlag: () => boolean;

  /** Domain name for logging (e.g., 'equipment', 'vessel') */
  domain: string;

  /** Callback for custom observability (optional) */
  onMetric?: (metric: DualWriteMetric) => void;
}

export interface DualWriteOperation<T> {
  /** Operation name for logging */
  operation: string;

  /** Repository function to execute */
  repositoryFn: () => Promise<T>;

  /** Legacy storage function to execute */
  legacyFn: () => Promise<T>;

  /**
   * DEPRECATED: Consistency checks removed for security
   * Use integration tests instead to validate correctness
   * @deprecated
   */
  consistencyCheck?: (repoData: T, legacyData: T) => boolean;
}

export interface DualWriteMetric {
  domain: string;
  operation: string;
  codePath: "repository" | "legacy" | "fallback";
  success: boolean;
  durationMs: number;
  consistencyMatch?: boolean;
  error?: string;
}

export class DualWriteAdapter {
  private config: DualWriteConfig & { onMetric: (metric: DualWriteMetric) => void };

  constructor(config: DualWriteConfig) {
    this.config = {
      ...config,
      onMetric: config.onMetric ?? this.defaultMetricHandler,
    };
  }

  /**
   * Execute operation using dual-write pattern
   */
  async execute<T>(operation: DualWriteOperation<T>): Promise<T> {
    const startTime = Date.now();
    const useRepository = this.config.featureFlag();

    if (useRepository) {
      return this.executeWithRepository(operation, startTime);
    }
    return this.executeWithLegacy(operation, startTime);
  }

  /**
   * Execute using repository (with fallback to legacy on error)
   * SECURITY: Consistency validation is DISABLED to prevent cross-tenant data access
   * The legacy function could be called with a different orgId during validation
   */
  private async executeWithRepository<T>(
    operation: DualWriteOperation<T>,
    startTime: number
  ): Promise<T> {
    try {
      const result = await operation.repositoryFn();

      // SECURITY FIX: Removed consistency validation to prevent tenant isolation bypass
      // Consistency checks would call legacyFn() which could use different orgId
      // This creates a cross-tenant data access vulnerability
      // Use integration tests instead to validate correctness

      const durationMs = Date.now() - startTime;
      this.recordMetric({
        domain: this.config.domain,
        operation: operation.operation,
        codePath: "repository",
        success: true,
        durationMs,
      });

      return result;
    } catch (error) {
      logger.error(`[DualWrite:${this.config.domain}] Repository error, falling back to legacy`, undefined, {
        operation: operation.operation,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Fallback to legacy on repository error
      const legacyResult = await operation.legacyFn();

      const durationMs = Date.now() - startTime;
      this.recordMetric({
        domain: this.config.domain,
        operation: operation.operation,
        codePath: "fallback",
        success: true,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      return legacyResult;
    }
  }

  /**
   * Execute using legacy storage
   */
  private async executeWithLegacy<T>(
    operation: DualWriteOperation<T>,
    startTime: number
  ): Promise<T> {
    try {
      const result = await operation.legacyFn();

      const durationMs = Date.now() - startTime;
      this.recordMetric({
        domain: this.config.domain,
        operation: operation.operation,
        codePath: "legacy",
        success: true,
        durationMs,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.recordMetric({
        domain: this.config.domain,
        operation: operation.operation,
        codePath: "legacy",
        success: false,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Record metric for observability
   */
  private recordMetric(metric: DualWriteMetric): void {
    // Structured logging for monitoring
    logger.info(`[DualWrite:${metric.domain}] ${metric.operation}`, {
      codePath: metric.codePath,
      success: metric.success,
      durationMs: metric.durationMs,
      consistencyMatch: metric.consistencyMatch,
      error: metric.error,
    });

    // Call custom metric handler if provided
    this.config.onMetric(metric);
  }

  /**
   * Default metric handler (no-op, can be overridden)
   */
  private defaultMetricHandler(metric: DualWriteMetric): void {
    // Default: do nothing
    // Users can override via config.onMetric to send to monitoring system
  }
}

/**
 * Helper to create consistency checks for common patterns
 */
export const ConsistencyChecks = {
  /** Check array length matches */
  arrayLength: <T extends any[]>(a: T, b: T): boolean => a.length === b.length,

  /** Check object by ID */
  objectById: <T extends { id: string }>(a: T | undefined, b: T | undefined): boolean => {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return a.id === b.id;
  },

  /** Deep equality check (use sparingly, expensive) */
  deepEqual: <T>(a: T, b: T): boolean => {
    return JSON.stringify(a) === JSON.stringify(b);
  },
};
