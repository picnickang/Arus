import { logger } from "../utils/logger";

const LOG_CTX = "StorageCircuitBreaker";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class StorageCircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureAt: Date | null = null;
  private openedAt: Date | null = null;

  private failureThreshold: number;
  private recoveryTimeMs: number;
  private halfOpenMaxAttempts: number;
  private timeoutMs: number;

  constructor(options?: {
    failureThreshold?: number;
    recoveryTimeMs?: number;
    halfOpenMaxAttempts?: number;
    timeoutMs?: number;
  }) {
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.recoveryTimeMs = options?.recoveryTimeMs ?? 30000;
    this.halfOpenMaxAttempts = options?.halfOpenMaxAttempts ?? 3;
    this.timeoutMs = options?.timeoutMs ?? 10000;
  }

  async execute<T>(operation: () => Promise<T>, operationName?: string): Promise<T> {
    if (this.state === "OPEN") {
      if (this.openedAt && Date.now() - this.openedAt.getTime() > this.recoveryTimeMs) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
        logger.info(LOG_CTX, "Circuit transitioning to HALF_OPEN");
      } else {
        throw new Error(`Storage circuit breaker is OPEN. Retry after ${this.recoveryTimeMs / 1000}s. Operation: ${operationName || "unknown"}`);
      }
    }

    try {
      const result = await Promise.race<T>([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Database operation timed out after ${this.timeoutMs}ms: ${operationName || "unknown"}`)), this.timeoutMs)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error, operationName);
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.halfOpenMaxAttempts) {
        this.state = "CLOSED";
        this.failureCount = 0;
        logger.info(LOG_CTX, "Circuit CLOSED — database recovered");
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(error: unknown, operationName?: string): void {
    this.failureCount++;
    this.lastFailureAt = new Date();

    if (this.state === "HALF_OPEN" || this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = new Date();
      logger.error(LOG_CTX, `Circuit OPENED after ${this.failureCount} failures. Operation: ${operationName}`, error);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): {
    state: CircuitState;
    failureCount: number;
    lastFailureAt: Date | null;
    openedAt: Date | null;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureAt,
      openedAt: this.openedAt,
    };
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = null;
  }
}

export const storageCircuitBreaker = new StorageCircuitBreaker();
export { StorageCircuitBreaker };
export default storageCircuitBreaker;
