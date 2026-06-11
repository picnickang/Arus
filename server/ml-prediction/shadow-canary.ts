/**
 * Wave 3.3 — Shadow + canary model serving.
 *
 * Two modes, both driven by Wave 0.6 feature flags so a runaway
 * candidate can be killed without a redeploy:
 *
 *   - shadow:  always call the production model, also call the
 *              candidate model, return production's result, record the
 *              divergence. Zero user impact, full A/B signal.
 *
 *   - canary:  route `canaryPercent` of traffic to the candidate and
 *              return its prediction; the remaining traffic goes to
 *              production. Used after shadow validates parity.
 *
 * The helper does not know what a prediction *is* — callers supply a
 * `divergence` function that returns a numeric distance between the
 * two predictions. Examples: absolute delta for RUL hours, 0/1 for a
 * classifier label mismatch, KL distance for a probability vector.
 *
 * Divergence above `alertThreshold` increments a counter and emits a
 * structured warn; this is what the on-call dashboard chart wires to.
 */

import client from "prom-client";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("MlPrediction:ShadowCanary");

export const shadowComparisonsTotal = new client.Counter({
  name: "arus_ml_shadow_comparisons_total",
  help: "Total shadow comparisons between production and candidate models.",
  labelNames: ["production_model_id", "candidate_model_id", "verdict"],
});

export const shadowDivergence = new client.Histogram({
  name: "arus_ml_shadow_divergence",
  help: "Distribution of divergence values between production and candidate models.",
  labelNames: ["production_model_id", "candidate_model_id"],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const canaryTrafficSplit = new client.Counter({
  name: "arus_ml_canary_traffic_total",
  help: "Canary traffic routing (which side served the request).",
  labelNames: ["production_model_id", "candidate_model_id", "served_by"],
});

export interface ShadowCanaryOptions<T> {
  productionModelId: string;
  candidateModelId?: string | undefined;
  candidatePredict?: (() => Promise<T>) | undefined;
  productionPredict: () => Promise<T>;
  /** Computes a non-negative distance between two predictions. */
  divergence?: ((production: T, candidate: T) => number) | undefined;
  /** Divergence value above which we emit a warn. */
  alertThreshold?: number | undefined;
  /** When set in [0,100], routes that percentage of traffic to the candidate. */
  canaryPercent?: number | undefined;
  /** Override the RNG for tests. */
  random?: (() => number) | undefined;
}

export interface ShadowCanaryResult<T> {
  result: T;
  servedBy: "production" | "candidate";
  candidateRan: boolean;
  divergence?: number | undefined;
}

const DEFAULT_THRESHOLD = 0.25;

/**
 * Single entrypoint for both shadow and canary modes. The mode is
 * implied by which inputs you set:
 *   - candidatePredict supplied, canaryPercent omitted → shadow
 *   - candidatePredict + canaryPercent (1..100)        → canary
 *   - candidatePredict omitted                         → pure production
 *
 * Errors in the candidate path NEVER propagate — shadow / canary is a
 * background experiment and must not regress production.
 */
export async function serveWithShadowOrCanary<T>(
  opts: ShadowCanaryOptions<T>
): Promise<ShadowCanaryResult<T>> {
  const {
    productionModelId,
    candidateModelId,
    productionPredict,
    candidatePredict,
    divergence,
    alertThreshold = DEFAULT_THRESHOLD,
    canaryPercent,
    random = Math.random,
  } = opts;

  // CANARY MODE — caller wants real traffic split.
  if (
    candidatePredict &&
    candidateModelId &&
    typeof canaryPercent === "number" &&
    canaryPercent > 0 &&
    canaryPercent <= 100
  ) {
    const useCandidate = random() * 100 < canaryPercent;
    if (useCandidate) {
      try {
        const result = await candidatePredict();
        canaryTrafficSplit.inc({
          production_model_id: productionModelId,
          candidate_model_id: candidateModelId,
          served_by: "candidate",
        });
        return { result, servedBy: "candidate", candidateRan: true };
      } catch (err) {
        logger.warn("Canary model threw — falling back to production", {
          err: err instanceof Error ? err.message : String(err),
          candidateModelId,
        });
      }
    }
    const result = await productionPredict();
    canaryTrafficSplit.inc({
      production_model_id: productionModelId,
      candidate_model_id: candidateModelId,
      served_by: "production",
    });
    return { result, servedBy: "production", candidateRan: false };
  }

  // SHADOW MODE — production always serves, candidate runs alongside.
  if (candidatePredict && candidateModelId) {
    const [prodRes, candRes] = await Promise.allSettled([productionPredict(), candidatePredict()]);
    if (prodRes.status === "rejected") {
      throw prodRes.reason;
    }
    const production = prodRes.value;
    if (candRes.status === "fulfilled" && divergence) {
      let div: number | undefined;
      try {
        div = divergence(production, candRes.value);
      } catch (err) {
        logger.warn("divergence() threw — skipping comparison", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
      if (typeof div === "number" && Number.isFinite(div)) {
        const verdict = div > alertThreshold ? "alert" : "ok";
        shadowComparisonsTotal.inc({
          production_model_id: productionModelId,
          candidate_model_id: candidateModelId,
          verdict,
        });
        shadowDivergence.observe(
          { production_model_id: productionModelId, candidate_model_id: candidateModelId },
          div
        );
        if (verdict === "alert") {
          logger.warn(`Shadow divergence ${div.toFixed(4)} > ${alertThreshold}`, {
            productionModelId,
            candidateModelId,
            divergence: div,
          });
        }
        return { result: production, servedBy: "production", candidateRan: true, divergence: div };
      }
    }
    return {
      result: production,
      servedBy: "production",
      candidateRan: candRes.status === "fulfilled",
    };
  }

  // PURE PRODUCTION — no candidate configured.
  const result = await productionPredict();
  return { result, servedBy: "production", candidateRan: false };
}
