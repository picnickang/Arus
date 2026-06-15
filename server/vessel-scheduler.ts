/**
 * Vessel Scheduler — onboard (SQLite, offline-first) recurring work.
 *
 * Cloud schedules its periodic jobs through pg-boss (server/background-jobs.ts);
 * a vessel has no pg-boss, so its recurring work runs from the setInterval
 * loops armed by server/bootstrap/schedulers.ts (which is skipped in embedded /
 * test mode). This module owns the onboard daily **PdM scoring** pass — the
 * producer that fills pdm_score_logs so GET /api/pdm/health and the
 * getEquipmentHealth fleet surfaces reflect real degradation onboard, exactly
 * as the pg-boss PDM_SCORING_DAILY cron does in the cloud.
 *
 * Cadence is watermark-driven rather than a naive 24h interval: a vessel may
 * reboot more than once a day, which would reset a plain interval and never
 * fire. Instead we wake hourly and run only when the newest pdm_score_logs row
 * is older than the daily threshold (or none exists). That makes the pass
 * idempotent across reboots and self-healing after extended downtime.
 *
 * Mode-gated: in cloud mode this is a no-op (pg-boss owns scoring); only
 * isLocalMode (vessel) arms the schedule.
 */

import { createLogger } from "./lib/structured-logger";
import { isLocalMode } from "./config/runtimeEnv";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { dbDevicesStorage } from "./db/devices/index.js";
import { processPdmScoring } from "./job-processors/pdm-scoring-processor.js";

const logger = createLogger("VesselScheduler");

// Wake hourly to check whether a daily pass is due. Short enough to catch up
// promptly after a reboot or downtime, negligible overhead onboard.
const PDM_CHECK_INTERVAL_MS = 60 * 60 * 1000;
// A pass is due when the newest score is older than this (or there is none).
// Slightly under 24h so a once-daily rhythm does not slip a day on check jitter.
const PDM_DUE_AFTER_MS = 20 * 60 * 60 * 1000;
// Let the DB/telemetry settle before the first onboard pass after boot.
const PDM_INITIAL_DELAY_MS = 2 * 60 * 1000;

let pdmInterval: ReturnType<typeof setInterval> | null = null;
let pdmInitialTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Pure cadence decision: is a scoring pass due given the newest score time?
 * Exported so the daily rhythm can be unit-tested without a database or clock.
 */
export function isPdmScoringDue(
  latestScoreTs: Date | null,
  now: number = Date.now(),
  dueAfterMs: number = PDM_DUE_AFTER_MS
): boolean {
  if (!latestScoreTs) {
    return true; // never scored — always due
  }
  return now - latestScoreTs.getTime() >= dueAfterMs;
}

export interface VesselPdmRunResult {
  ran: boolean;
  reason: "cloud-delegated" | "not-due" | "scored" | "error";
  scored?: number;
  skipped?: number;
}

/**
 * Run the daily PdM scoring pass if one is due (or forced). Vessel-only: in
 * cloud mode the pg-boss PDM_SCORING_DAILY cron owns scoring, so this no-ops.
 * The whole module is loaded lazily by bootstrap/schedulers.ts (only when
 * schedulers are enabled), so these imports stay static without weighing on
 * boot.
 */
export async function runVesselPdmScoringIfDue(
  opts: { force?: boolean } = {}
): Promise<VesselPdmRunResult> {
  if (!isLocalMode) {
    return { ran: false, reason: "cloud-delegated" };
  }
  try {
    if (!opts.force) {
      const latest = await dbDevicesStorage.getLatestPdmScoreTimestamp();
      if (!isPdmScoringDue(latest)) {
        return { ran: false, reason: "not-due" };
      }
    }

    const summary = await processPdmScoring({ orgIds: [DEFAULT_ORG_ID] });
    logger.info(
      `[VesselPdM] Daily scoring pass: ${summary.equipmentScored} scored, ` +
        `${summary.equipmentSkipped} skipped (${summary.durationMs}ms)`
    );
    return {
      ran: true,
      reason: "scored",
      scored: summary.equipmentScored,
      skipped: summary.equipmentSkipped,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[VesselPdM] Scoring pass failed:", undefined, message);
    return { ran: false, reason: "error" };
  }
}

export function setupVesselSchedules(): void {
  if (!isLocalMode) {
    // Cloud: pg-boss PDM_SCORING_DAILY produces scores. Nothing to arm here.
    logger.info("[Vessel Scheduler] Cloud mode — PdM scoring handled by pg-boss");
    return;
  }
  if (process.env["DISABLE_VESSEL_PDM_SCORING"] === "true") {
    logger.info("[Vessel Scheduler] Vessel PdM scoring disabled via env");
    return;
  }

  // Initial pass shortly after boot (covers a vessel that reboots more often
  // than daily — the watermark suppresses redundant re-scoring), then an hourly
  // check that runs whenever a daily pass comes due.
  pdmInitialTimer = setTimeout(() => {
    void runVesselPdmScoringIfDue();
  }, PDM_INITIAL_DELAY_MS);
  pdmInitialTimer.unref?.();

  pdmInterval = setInterval(() => {
    void runVesselPdmScoringIfDue();
  }, PDM_CHECK_INTERVAL_MS);
  pdmInterval.unref?.();

  logger.info("[Vessel Scheduler] Vessel PdM scoring scheduled (hourly check, daily cadence)");
}

export function startVesselScheduler(): void {
  // Schedules are armed by setupVesselSchedules(); kept for back-compat.
}

export function stopVesselScheduler(): void {
  if (pdmInterval) {
    clearInterval(pdmInterval);
    pdmInterval = null;
  }
  if (pdmInitialTimer) {
    clearTimeout(pdmInitialTimer);
    pdmInitialTimer = null;
  }
}

export const vesselScheduler = {
  setup: setupVesselSchedules,
  start: startVesselScheduler,
  stop: stopVesselScheduler,
};
