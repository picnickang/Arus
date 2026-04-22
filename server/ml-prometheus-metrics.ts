/**
 * ML Prometheus Metrics - Minimal No-Op Shim
 *
 * Historical context: this file used to re-export ~50 symbols from
 * `./ml-prometheus-metrics/index.js`, a directory that was never created.
 * Importing the file therefore failed at load time, but only callers that
 * actually triggered the import (background jobs, technician insight) saw
 * the failure — and those failures were swallowed by upstream try/catch.
 *
 * Audit (2026-04): only three symbols are actually called anywhere in the
 * codebase: `recordTechnicianInsight`, `recordTechnicianInsightFallback`,
 * and `recordFleetTechnicianInsight`. All three are fire-and-forget
 * observability hooks where a no-op is functionally safe.
 *
 * This file now provides those three as no-ops so the imports resolve and
 * the dead reference disappears. Real Prometheus wiring (using
 * `server/observability/ml-metrics.ts` as the actual implementation source)
 * can be reintroduced later as a separate task without touching callsites.
 */

export function recordTechnicianInsight(
  _orgId: string,
  _statusLevel: string,
  _durationMs: number,
  _success: boolean
): void {
  // no-op
}

export function recordTechnicianInsightFallback(_orgId: string, _reason: string): void {
  // no-op
}

export function recordFleetTechnicianInsight(
  _orgId: string,
  _count: number,
  _durationMs: number,
  _success: boolean
): void {
  // no-op
}
