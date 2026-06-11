/**
 * Standard polling intervals + visibility gating for TanStack Query.
 *
 * Use `refetchInterval: pollingInterval(POLL_INTERVALS.STANDARD)` instead of
 * a numeric literal. TanStack v5 already pauses interval refetches when the
 * window loses focus (`refetchIntervalInBackground` defaults to false); the
 * function form adds document-visibility gating, which is more reliable in
 * Tauri/Capacitor webviews where focus events are flaky, and centralizes the
 * interval values so they can be tuned (or relaxed when a WebSocket channel
 * covers the same data).
 */

export const POLL_INTERVALS = {
  /** Live operational views (active telemetry charts, alarm panels). */
  FAST: 15_000,
  /** Default for dashboards and status lists. */
  STANDARD: 30_000,
  /** Slowly changing summaries. */
  SLOW: 60_000,
  /** Background freshness for reference-ish data. */
  RELAXED: 5 * 60_000,
} as const;

type RefetchIntervalFn = () => number | false;

export function pollingInterval(ms: number): RefetchIntervalFn {
  return () =>
    typeof document !== "undefined" && document.visibilityState === "hidden" ? false : ms;
}
