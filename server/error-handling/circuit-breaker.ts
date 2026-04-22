/**
 * Circuit Breaker Implementation
 */

import { structuredLog } from "../logging";
import { CircuitBreakerState, CircuitBreakerError, ERROR_HANDLING_CONFIG } from "./types";

export const circuitBreakers = new Map<string, CircuitBreakerState>();

export class CircuitBreaker {
  private metricsCallbacks: {
    onStateChange?: (service: string, state: 0 | 1 | 2) => void;
    onFailure?: (service: string) => void;
    onCall?: (service: string, status: "success" | "failure" | "circuit_open") => void;
    onLatency?: (service: string, operation: string, durationMs: number) => void;
  } = {};

  setMetricsCallbacks(callbacks: typeof this.metricsCallbacks) {
    this.metricsCallbacks = callbacks;
  }

  private getState(serviceName: string): CircuitBreakerState {
    if (!circuitBreakers.has(serviceName)) {
      circuitBreakers.set(serviceName, {
        failures: 0,
        lastFailureTime: 0,
        state: "CLOSED",
        successCount: 0,
      });
    }
    return circuitBreakers.get(serviceName)!;
  }

  private updateState(serviceName: string, state: Partial<CircuitBreakerState>) {
    const current = this.getState(serviceName);
    const previousState = current.state;
    circuitBreakers.set(serviceName, { ...current, ...state });

    // Only emit the state-change metric when the state actually transitions.
    // (Previously this read `state.state?.state` — a typo that double-derefs
    // a string and always returned undefined, firing the callback on every
    // partial update including ones that don't change `state`.)
    if (state.state !== undefined && state.state !== previousState) {
      const stateValue = state.state === "OPEN" ? 1 : state.state === "HALF_OPEN" ? 2 : 0;
      this.metricsCallbacks.onStateChange?.(serviceName, stateValue as 0 | 1 | 2);
    }
  }

  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const state = this.getState(serviceName);
    const now = Date.now();

    if (state.state === "OPEN") {
      if (now - state.lastFailureTime > ERROR_HANDLING_CONFIG.CIRCUIT_BREAKER.TIMEOUT_MS) {
        this.updateState(serviceName, { state: "HALF_OPEN", successCount: 0 });
        structuredLog("info", `Circuit breaker transitioning to HALF_OPEN for ${serviceName}`);
      } else {
        this.metricsCallbacks.onCall?.(serviceName, "circuit_open");
        if (fallback) {
          structuredLog("warn", `Circuit breaker OPEN for ${serviceName}, using fallback`);
          return fallback();
        }
        throw new CircuitBreakerError(serviceName);
      }
    }

    const startTime = Date.now();
    try {
      const result = await operation();
      const durationMs = Date.now() - startTime;

      this.metricsCallbacks.onCall?.(serviceName, "success");
      this.metricsCallbacks.onLatency?.(serviceName, "execute", durationMs);

      // Re-read state for the success path: another concurrent call may have
      // transitioned us out of HALF_OPEN since `state` was captured at entry.
      const liveState = this.getState(serviceName);
      if (liveState.state === "HALF_OPEN") {
        const newSuccessCount = liveState.successCount + 1;
        if (newSuccessCount >= ERROR_HANDLING_CONFIG.CIRCUIT_BREAKER.SUCCESS_THRESHOLD) {
          this.updateState(serviceName, { state: "CLOSED", failures: 0, successCount: 0 });
          structuredLog("info", `Circuit breaker CLOSED for ${serviceName}`);
        } else {
          this.updateState(serviceName, { successCount: newSuccessCount });
        }
      } else {
        this.updateState(serviceName, { failures: 0 });
      }
      return result;
    } catch (error) {
      this.metricsCallbacks.onCall?.(serviceName, "failure");
      this.metricsCallbacks.onFailure?.(serviceName);
      const newFailures = state.failures + 1;
      this.updateState(serviceName, { failures: newFailures, lastFailureTime: now });

      if (newFailures >= ERROR_HANDLING_CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD) {
        this.updateState(serviceName, { state: "OPEN" });
        structuredLog("error", `Circuit breaker OPEN for ${serviceName}`, {
          operation: "circuit_breaker",
          metadata: { failures: newFailures, serviceName },
        });
      }

      // Re-read state after potential transition above to avoid stale-state
      // behavior when the threshold is crossed during this very failure.
      const currentState = this.getState(serviceName);
      if (fallback && currentState.state === "OPEN") {
        structuredLog("warn", `Using fallback for failed ${serviceName}`);
        return fallback();
      }
      throw error;
    }
  }

  getStatus(serviceName: string) {
    return this.getState(serviceName);
  }
}

export const circuitBreaker = new CircuitBreaker();
