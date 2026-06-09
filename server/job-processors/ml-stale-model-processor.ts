/**
 * #110 — Stale-model SLO sweeper.
 *
 * For every `(orgId, equipmentType)` that currently has a deployed
 * model older than the SLO threshold (default 14 days = 2× the weekly
 * retrain cadence), emit a structured alert keyed
 * `event=ml.model.stale` so operators / Loki dashboards / SLO burn
 * alerts can surface it. The sweeper is observation-only: it never
 * mutates ml_models, never promotes, never archives — promotion stays
 * gated through the weekly retrain path. Runs daily so a missed
 * weekly run shows up within ≤24h instead of going silent until the
 * next Sunday.
 *
 * Why a sweeper rather than emitting on every inference call:
 *   - Inference-path checks add hot-path latency for a check whose
 *     value (a single alert per stale model) is bounded.
 *   - A scheduled sweep also catches `(orgId, equipmentType)` pairs
 *     that have stopped serving — e.g. equipment retired — which the
 *     inference path would never reach.
 */

import { findStaleDeployedModels } from "../domains/ml-analytics/infrastructure/retraining-queries";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("MlStaleModelProcessor");

/** Match the 7-day weekly cadence × 2 — anything older than 14 days
 *  means we missed at least one retrain cycle. Validate so a typo in
 *  the env (e.g. `14d`) doesn't silently disable detection by yielding
 *  NaN — the lt(deployedOn, NaN-date) query would match no rows. */
function resolveThresholdDays(): number {
  const raw = process.env['PDM_STALE_MODEL_DAYS'];
  if (raw === undefined || raw === "") {return 14;}
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    logger.warn("PDM_STALE_MODEL_DAYS invalid — falling back to 14", { raw });
    return 14;
  }
  return n;
}
const STALE_MODEL_THRESHOLD_DAYS = resolveThresholdDays();

export interface StaleModelAlert {
  orgId: string;
  equipmentType: string | null;
  modelId: string;
  deployedOn: string | null;
  ageDays: number;
}

export interface StaleModelCheckResult {
  checkedAt: string;
  thresholdDays: number;
  staleCount: number;
  alerts: StaleModelAlert[];
}

export async function processStaleModelCheck(): Promise<StaleModelCheckResult> {
  const checkedAt = new Date();
  const cutoff = new Date(checkedAt.getTime() - STALE_MODEL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  let rows: Array<{
    id: string;
    orgId: string;
    equipmentType: string | null;
    deployedOn: Date | null;
  }> = [];
  try {
    rows = await findStaleDeployedModels(cutoff);
  } catch (err) {
    logger.warn("Stale-model sweep query failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { checkedAt: checkedAt.toISOString(), thresholdDays: STALE_MODEL_THRESHOLD_DAYS, staleCount: 0, alerts: [] };
  }

  const alerts: StaleModelAlert[] = rows.map((r) => {
    const deployedMs = r.deployedOn ? r.deployedOn.getTime() : checkedAt.getTime();
    const ageDays = Math.floor((checkedAt.getTime() - deployedMs) / (24 * 60 * 60 * 1000));
    return {
      orgId: r.orgId,
      equipmentType: r.equipmentType ?? null,
      modelId: r.id,
      deployedOn: r.deployedOn ? r.deployedOn.toISOString() : null,
      ageDays,
    };
  });

  for (const alert of alerts) {
    logger.warn("ml.model.stale", {
      event: "ml.model.stale",
      ...alert,
      thresholdDays: STALE_MODEL_THRESHOLD_DAYS,
    });
  }

  logger.info("Stale-model sweep finished", {
    checkedAt: checkedAt.toISOString(),
    thresholdDays: STALE_MODEL_THRESHOLD_DAYS,
    staleCount: alerts.length,
  });

  return {
    checkedAt: checkedAt.toISOString(),
    thresholdDays: STALE_MODEL_THRESHOLD_DAYS,
    staleCount: alerts.length,
    alerts,
  };
}
