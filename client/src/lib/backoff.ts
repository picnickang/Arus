/**
 * Full-jitter exponential backoff.
 *
 * Returns a randomized delay in milliseconds for retry attempt `attempt`
 * (0-based). Full jitter — `random(0, min(cap, base * 2^attempt))` — spreads
 * reconnect storms out instead of having every vessel client retry in lockstep
 * the moment a flaky link returns (the "thundering herd" problem on shared
 * shore-side bandwidth).
 *
 * Pure and side-effect free; the only nondeterminism is `Math.random`, which
 * tests stub for deterministic assertions.
 */
export type BackoffErrorType = "timeout" | "network" | "unknown";

export interface BackoffOptions {
  /** Base delay before jitter, doubled per attempt. */
  baseMs?: number;
  /** Upper bound on the pre-jitter delay. */
  capMs?: number;
  /**
   * Timeouts back off more aggressively than other failures: a timeout usually
   * means the far end is overloaded, so we give it longer to recover.
   */
  errorType?: BackoffErrorType;
}

const DEFAULT_BASE_MS = 4_000;
const TIMEOUT_BASE_MS = 8_000;
const DEFAULT_CAP_MS = 60_000;

export function computeBackoffDelay(attempt: number, opts: BackoffOptions = {}): number {
  const base = opts.baseMs ?? (opts.errorType === "timeout" ? TIMEOUT_BASE_MS : DEFAULT_BASE_MS);
  const cap = opts.capMs ?? DEFAULT_CAP_MS;
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const exponential = base * 2 ** safeAttempt;
  const ceiling = Math.min(cap, exponential);
  return Math.random() * ceiling;
}
