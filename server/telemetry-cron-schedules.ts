/**
 * Telemetry lifecycle cron registrations (rollup / partition maintenance /
 * retention), extracted from background-jobs.ts initialize().
 *
 * Each schedule is registered independently and failures are non-fatal —
 * one broken queue must not take down the others (same contract as the
 * inline blocks this replaces). pg-boss persists schedules, so re-running
 * on every boot does not double-enqueue.
 */

import type PgBoss from "pg-boss";
import { logger } from "./utils/logger";

interface TelemetryCronJobTypes {
  TELEMETRY_ROLLUP_HOURLY: string;
  TELEMETRY_PARTITION_MAINTENANCE: string;
  TELEMETRY_RETENTION: string;
  DLQ_REPLAY: string;
}

interface TelemetryCronSpec {
  type: keyof TelemetryCronJobTypes;
  cron: string;
  cadence: string;
  rationale: string;
}

// Ordering rationale, end to end: rollups land 5 min past each hour so the
// 02:00 warehouse export always reads finished 1_hour buckets; the DLQ
// auto-replay sweep (:20) runs after each rollup so readings it recovers
// into equipment_telemetry are picked up by the NEXT rollup's overlapping
// lookback rather than racing the current one; partition maintenance
// (01:15) runs before retention so the boundary months retention inspects
// are real partitions; retention (03:30) runs after the export so deletes
// can never race it, and offset from the Sunday 03:00 model retrain.
// Retention is additionally gated per-run by TELEMETRY_RETENTION_ENABLED
// inside its processor (destructive job).
const TELEMETRY_CRON_SCHEDULES: TelemetryCronSpec[] = [
  {
    type: "TELEMETRY_ROLLUP_HOURLY",
    cron: "5 * * * *",
    cadence: "hourly",
    rationale: "rollup",
  },
  {
    type: "DLQ_REPLAY",
    cron: "20 * * * *",
    cadence: "hourly",
    rationale: "DLQ auto-replay",
  },
  {
    type: "TELEMETRY_PARTITION_MAINTENANCE",
    cron: "15 1 * * *",
    cadence: "daily",
    rationale: "partition maintenance",
  },
  {
    type: "TELEMETRY_RETENTION",
    cron: "30 3 * * *",
    cadence: "daily",
    rationale: "retention",
  },
];

export async function scheduleTelemetryLifecycleJobs(
  boss: PgBoss,
  jobTypes: TelemetryCronJobTypes,
  ensureQueue: (boss: PgBoss, queueName: string) => Promise<void>
): Promise<void> {
  for (const spec of TELEMETRY_CRON_SCHEDULES) {
    const jobType = jobTypes[spec.type];
    try {
      await ensureQueue(boss, jobType);
      await boss.schedule(jobType, spec.cron, {}, { retryLimit: 1 });
      logger.info(`Scheduled ${spec.cadence} cron: ${jobType} @ ${spec.cron} UTC`);
    } catch (schedErr) {
      const msg = schedErr instanceof Error ? schedErr.message : String(schedErr);
      logger.warn(`Failed to register telemetry ${spec.rationale} schedule: ${msg}`);
    }
  }
}
