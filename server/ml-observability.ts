/**
 * ML observability sink for prediction success/failure events.
 *
 * Recreated 2026-04 after a refactor left `model-loader.ts` importing
 * `../ml-observability.js` from a file that no longer existed. Only two
 * methods are called anywhere in the codebase: `logSuccess` and
 * `logFailure`. Both are fire-and-forget structured-log hooks where a
 * lightweight pass-through implementation is functionally safe.
 *
 * Forwards to the shared logger so events still land in the standard log
 * pipeline; richer Prometheus wiring can be reintroduced later without
 * touching callsites.
 */

import { logger } from "./utils/logger.js";

interface PredictionLikeResult {
  failureProbability?: number;
  daysToFailure?: number;
  confidence?: number;
}

export const mlObservability = {
  logSuccess(
    equipmentId: string,
    orgId: string,
    method: string,
    result: PredictionLikeResult,
    latencyMs: number
  ): void {
    logger.info("[ML] Prediction success", {
      equipmentId,
      orgId,
      method,
      latencyMs,
      failureProbability: result?.failureProbability,
      daysToFailure: result?.daysToFailure,
      confidence: result?.confidence,
    });
  },

  logFailure(
    equipmentId: string,
    orgId: string,
    method: string,
    error: Error,
    latencyMs: number
  ): void {
    logger.warn("[ML] Prediction failure", {
      equipmentId,
      orgId,
      method,
      latencyMs,
      error: error?.message ?? String(error),
    });
  },
};
