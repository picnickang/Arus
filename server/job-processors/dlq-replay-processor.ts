/**
 * Hourly DLQ auto-replay sweep.
 *
 * Replay was operator-only: failed batches sat in their dead-letter
 * queues until someone called the admin replay endpoint, and the
 * DlqDepthHigh alert (>100 entries for 15m) was the only nudge. This
 * sweep drains transient-failure backlogs automatically while leaving
 * poison entries — retryCount at or above the threshold — for manual
 * replay (they stay listable and are eventually pruned by the queue's
 * retentionDays).
 *
 * Failure-storm guard: a queue whose replays keep failing (e.g. the
 * sqlite-bridge circuit breaker is still open) is abandoned for the rest
 * of the run after CONSECUTIVE_FAILURE_ABORT consecutive failures. An
 * extended outage therefore bumps retryCount on only a handful of
 * entries per sweep instead of marching the whole backlog toward the
 * poison threshold.
 *
 * Fleet-wide tenant scope: replay handlers re-enter their original write
 * path (the bridge handler feeds telemetryBatchWriter.writeBatch), which
 * already carries per-reading org handling — there is no orgId in the
 * cron payload.
 */

import { createLogger } from "../lib/structured-logger";
import { getRegisteredQueues } from "../services/dead-letter-queue";

const logger = createLogger("JobProcessors:DlqReplay");

const CONSECUTIVE_FAILURE_ABORT = 3;

export interface DlqReplayJobData {
  /** Max entries replayed per queue per run. Defaults to 100. */
  maxPerQueue?: number;
  /** Entries with retryCount >= this are left for manual replay. Defaults to 5. */
  maxRetryCount?: number;
}

export interface DlqReplayJobSummary {
  queuesScanned: number;
  queuesWithoutHandler: number;
  replaySucceeded: number;
  replayFailed: number;
  skippedPoison: number;
  durationMs: number;
}

export async function processDlqReplay(data: DlqReplayJobData = {}): Promise<DlqReplayJobSummary> {
  const startedAt = Date.now();
  const maxPerQueue = data.maxPerQueue ?? 100;
  const maxRetryCount = data.maxRetryCount ?? 5;

  const summary: DlqReplayJobSummary = {
    queuesScanned: 0,
    queuesWithoutHandler: 0,
    replaySucceeded: 0,
    replayFailed: 0,
    skippedPoison: 0,
    durationMs: 0,
  };

  for (const queue of getRegisteredQueues()) {
    summary.queuesScanned++;
    if (!queue.hasReplayHandler()) {
      // Without a handler replay() can only no-op; skip instead of
      // generating one "No replay handler configured" result per entry.
      summary.queuesWithoutHandler++;
      continue;
    }

    // Snapshot the candidate ids up front: replay() mutates the queue
    // (success removes, failure bumps retryCount), so iterating a live
    // list while replaying would skip entries.
    const entries = queue.list({});
    const poison = entries.filter((e) => e.retryCount >= maxRetryCount);
    summary.skippedPoison += poison.length;
    const candidates = entries.filter((e) => e.retryCount < maxRetryCount).slice(0, maxPerQueue);

    let consecutiveFailures = 0;
    for (const entry of candidates) {
      const result = await queue.replay(entry.id);
      if (result.success) {
        summary.replaySucceeded++;
        consecutiveFailures = 0;
      } else {
        summary.replayFailed++;
        consecutiveFailures++;
        if (consecutiveFailures >= CONSECUTIVE_FAILURE_ABORT) {
          logger.warn(
            `Abandoning queue "${queue.name}" for this sweep after ` +
              `${consecutiveFailures} consecutive replay failures`,
            { lastError: result.error }
          );
          break;
        }
      }
    }
  }

  summary.durationMs = Date.now() - startedAt;
  logger.info("DLQ replay sweep finished", { ...summary });
  return summary;
}
