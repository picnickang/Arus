/**
 * Single-flight wrapper for periodic async work.
 *
 * `setInterval(async () => …)` does NOT wait for the previous tick to settle:
 * if a tick runs longer than its interval, the next one fires while the prior
 * is still in flight, so two runs race the same state (last-write-wins data
 * loss in refresh/expiry schedulers). Wrap the tick so an overlapping
 * invocation is skipped while a prior run is active.
 *
 * The returned function is a drop-in for the interval callback. When a run is
 * already active, the new call returns immediately; `onSkip` (if provided) is
 * invoked so callers can log the skip. Errors thrown by `fn` are re-thrown
 * after clearing the in-flight flag, so the wrapper never wedges itself.
 */
export function withSingleFlight(
  fn: () => Promise<void>,
  onSkip?: () => void
): () => Promise<void> {
  let running = false;
  return () => {
    if (running) {
      onSkip?.();
      return Promise.resolve();
    }
    running = true;
    // `.finally` (not an inner await) keeps the flag reset on both resolve and
    // reject while leaving the returned promise's outcome untouched.
    return fn().finally(() => {
      running = false;
    });
  };
}
