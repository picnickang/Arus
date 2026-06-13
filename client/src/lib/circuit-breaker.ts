/**
 * Minimal circuit breaker (plain TypeScript — no state-machine library).
 *
 * Guards a flaky dependency (the backend) so a string of connection failures
 * trips the breaker `open` and subsequent calls fail fast instead of each one
 * burning the full request timeout. After `resetTimeoutMs` the breaker drifts
 * to `halfOpen` and lets a single probe through: success closes it, failure
 * re-opens it.
 *
 * Only *connection-level* failures should feed this (see `isNetworkFailure` in
 * queryClient-request.ts). HTTP 4xx/5xx are valid responses from a reachable
 * server and must not trip the breaker.
 *
 * The `open -> halfOpen` transition is evaluated lazily in `canRequest()` from
 * the clock rather than a timer, so the breaker holds no resources and is
 * trivially testable by stubbing `Date.now`.
 */
export type CircuitState = "closed" | "open" | "halfOpen";

export interface CircuitBreakerOptions {
  /** Consecutive failures in `closed` before tripping to `open`. */
  failureThreshold?: number;
  /** How long `open` waits before allowing a `halfOpen` probe. */
  resetTimeoutMs?: number;
}

export interface CircuitBreaker {
  /** Whether a request may proceed now (also advances open -> halfOpen). */
  canRequest(): boolean;
  /** Current state (advances open -> halfOpen if the window has elapsed). */
  getState(): CircuitState;
  recordSuccess(): void;
  recordFailure(): void;
  reset(): void;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 30_000;

export function createCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreaker {
  const failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const resetTimeoutMs = options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;

  let state: CircuitState = "closed";
  let failureCount = 0;
  let openedAt = 0;

  function refresh(): CircuitState {
    if (state === "open" && Date.now() - openedAt >= resetTimeoutMs) {
      state = "halfOpen";
    }
    return state;
  }

  return {
    canRequest(): boolean {
      // Both closed and the single half-open probe are allowed through.
      return refresh() !== "open";
    },
    getState(): CircuitState {
      return refresh();
    },
    recordSuccess(): void {
      state = "closed";
      failureCount = 0;
    },
    recordFailure(): void {
      if (refresh() === "halfOpen") {
        // The probe failed — straight back to open for another cooldown.
        state = "open";
        openedAt = Date.now();
        return;
      }
      failureCount += 1;
      if (failureCount >= failureThreshold) {
        state = "open";
        openedAt = Date.now();
      }
    },
    reset(): void {
      state = "closed";
      failureCount = 0;
      openedAt = 0;
    },
  };
}

/**
 * Shared breaker for the single backend this client talks to. ARUS is
 * single-tenant and addresses one backend (cloud API or vessel-local sidecar),
 * so a module-level instance is the right granularity.
 */
export const backendCircuit = createCircuitBreaker();
