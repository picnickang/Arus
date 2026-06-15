/**
 * PdM scoring producer (fleet-wide daily cron).
 *
 * The PdM read surfaces (GET /api/pdm/health, fleet summaries, the ~20
 * getEquipmentHealth consumers) had no producer — pdm_score_logs was never
 * written, so the health endpoint always degraded to its fallback. This job
 * fills that gap: per equipment, it derives a health score from recent
 * telemetry using the existing statistical engine (getMultiSensorData ->
 * calculateDegradationMetrics -> statisticalFailurePrediction, all of which run
 * in both Postgres and SQLite after the dialect-aware reconciliation) and writes
 * one pdm_score_logs row.
 *
 * Fleet-wide cron: the payload carries no orgId. Orgs are enumerated from
 * `organizations` (not from telemetry, which is RLS-pinned) and each org's pass
 * runs under withTenantContext so reads/writes resolve through the pinned,
 * RLS-scoped connection. Per-equipment and per-org failures are collected and
 * never abort the sweep — mirroring the telemetry-rollup orchestrator.
 *
 * Known limitation: calculateDegradationMetrics counts anomalies from
 * reading.anomalyScore, which getMultiSensorData does not populate, so the score
 * is currently trend/variability-driven (see the "anomaly join" follow-up).
 */

import { createLogger } from "../lib/structured-logger";
import { db } from "../db.js";
import { organizations } from "@shared/schema.js";
import { withTenantContext } from "../middleware/db-context.js";
import { dbEquipmentStorage, dbDevicesStorage } from "../repositories.js";
import {
  calculateDegradationMetrics,
  getMultiSensorData,
  statisticalFailurePrediction,
} from "../ml-analytics/failure-prediction.js";

const logger = createLogger("JobProcessors:PdmScoring");

const DEFAULT_LOOKBACK_DAYS = 30;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PdmScoringJobData {
  /** Optional override of orgIds for ad-hoc/back-fill runs. */
  orgIds?: string[];
  /** Telemetry lookback window (days). Defaults to 30. */
  lookbackDays?: number;
}

export interface PdmScoringJobSummary {
  orgsTotal: number;
  orgsSucceeded: number;
  orgsFailed: number;
  equipmentScored: number;
  equipmentSkipped: number;
  durationMs: number;
  failures: Array<{ orgId: string; error: string }>;
}

async function scoreOrg(
  orgId: string,
  lookbackDays: number
): Promise<{ scored: number; skipped: number }> {
  const equipmentIds = await dbEquipmentStorage.getEquipmentIdsForOrg(orgId);
  let scored = 0;
  let skipped = 0;

  for (const equipmentId of equipmentIds) {
    const readings = await getMultiSensorData(equipmentId, lookbackDays);
    // statisticalFailurePrediction needs enough per-sensor history to be
    // meaningful (calculateDegradationMetrics requires >= 5 readings/sensor).
    if (readings.length < 5) {
      skipped++;
      continue;
    }
    const metrics = calculateDegradationMetrics(readings);
    const prediction = statisticalFailurePrediction(metrics);
    const healthIdx = Math.round(100 * (1 - prediction.failureProbability));
    const predictedDueDate =
      prediction.predictedFailureDate ??
      new Date(Date.now() + prediction.remainingUsefulLife * MILLIS_PER_DAY);

    await dbDevicesStorage.createPdmScore({
      orgId,
      equipmentId,
      healthIdx,
      pFail30d: prediction.failureProbability,
      predictedDueDate,
      contextJson: {
        method: "statistical-degradation",
        riskLevel: prediction.riskLevel,
        failureMode: prediction.failureMode,
        degradationScore: metrics.degradationScore,
        criticalSensors: metrics.criticalSensors,
        remainingUsefulLifeDays: prediction.remainingUsefulLife,
      },
    });
    scored++;
  }

  return { scored, skipped };
}

export async function processPdmScoring(
  data: PdmScoringJobData = {}
): Promise<PdmScoringJobSummary> {
  const startedAt = Date.now();
  const lookbackDays = data.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;

  const orgIds =
    data.orgIds && data.orgIds.length > 0
      ? data.orgIds
      : (await db.select({ id: organizations.id }).from(organizations)).map((o) => o.id);

  let equipmentScored = 0;
  let equipmentSkipped = 0;
  const failures: Array<{ orgId: string; error: string }> = [];

  for (const orgId of orgIds) {
    try {
      const result = await withTenantContext(orgId, () => scoreOrg(orgId, lookbackDays));
      equipmentScored += result.scored;
      equipmentSkipped += result.skipped;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ orgId, error: message });
      logger.error(`PdM scoring failed for org ${orgId}`, { error: message });
    }
  }

  const summary: PdmScoringJobSummary = {
    orgsTotal: orgIds.length,
    orgsSucceeded: orgIds.length - failures.length,
    orgsFailed: failures.length,
    equipmentScored,
    equipmentSkipped,
    durationMs: Date.now() - startedAt,
    failures,
  };
  logger.info("PdM scoring sweep finished", { ...summary, failures: undefined });
  return summary;
}
