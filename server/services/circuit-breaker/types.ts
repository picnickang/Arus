export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
  name: string;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export interface CircuitBreakerEvents {
  stateChange: { from: CircuitState; to: CircuitState; name: string };
  failure: { error: Error; name: string };
  success: { name: string };
  halfOpenAttempt: { attempt: number; maxAttempts: number; name: string };
}
