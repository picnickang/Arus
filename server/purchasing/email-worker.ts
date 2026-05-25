/**
 * Email Queue Worker
 * Improvement #4: Processes pending email queue items with retry logic,
 * dead-letter handling, and structured logging.
 *
 * Usage:
 *   import { startEmailWorker, stopEmailWorker } from "./email-worker";
 *   startEmailWorker(); // call once at server startup
 *   stopEmailWorker();  // call on graceful shutdown
 *
 * The worker polls the emailQueue table every POLL_INTERVAL_MS.
 * Failed items are retried up to MAX_ATTEMPTS times with exponential backoff.
 * Items exceeding MAX_ATTEMPTS are marked "dead_letter" for manual review.
 *
 * ============================================================================
 * LAUNCH P0 FIX #3 — Expire-on-skip behavior
 * ============================================================================
 *
 * Previously, when SMTP was not configured, the worker logged a warning and
 * `continue`d, leaving the queued email in status='pending' forever. If SMTP
 * got configured later (e.g. customer runs their first `arus set-smtp`
 * command on day 14), the worker would wake up with a multi-week backlog of
 * "pending" emails and try to send them all at once — blowing through SMTP
 * rate limits and burning the customer's sender reputation. And more
 * concerningly, shipping weeks-old notifications that the operator already
 * handled through some other channel.
 *
 * Now:
 *   1. When SMTP is unconfigured, each skipped item is marked 'expired'
 *      (not left pending) so it won't be resurrected later.
 *   2. On every batch, any queue item older than MAX_QUEUE_AGE_HOURS is
 *      marked 'expired' regardless of SMTP state. This catches the case
 *      where SMTP IS configured but the queue worker was down long enough
 *      that sending stale alerts would be counterproductive.
 *   3. Both paths log clearly so operators know why emails weren't sent.
 *
 * The expiry age defaults to 24 hours (via EMAIL_QUEUE_MAX_AGE_HOURS env var).
 * After 24 hours, an unsent alert is almost certainly not useful to send
 * anymore — the underlying condition has either cleared or been handled.
 * Tune per operator if they disagree.
 * ============================================================================
 */

import { db } from "../db";
import { eq, and, lt, sql } from "drizzle-orm";
import { emailQueue } from "@shared/schema";
import { logger } from "../utils/logger";
import nodemailer from "nodemailer";

const LOG_CTX = "EmailWorker";

const POLL_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;

/**
 * Queue items older than this are auto-expired. Applies regardless of SMTP
 * state — the principle is "if it hasn't been sent in N hours, it's stale
 * and sending it now would be worse than not sending it."
 *
 * Override via env: EMAIL_QUEUE_MAX_AGE_HOURS=48 (etc).
 */
const MAX_QUEUE_AGE_HOURS = Number.parseInt(process.env['EMAIL_QUEUE_MAX_AGE_HOURS'] ?? "24", 10);

let intervalHandle: ReturnType<typeof setInterval> | null = null;

function createTransport() {
  const host = process.env['SMTP_HOST'];
  const port = Number.parseInt(process.env['SMTP_PORT'] ?? "587", 10);
  const user = process.env['SMTP_USER'];
  const pass = process.env['SMTP_PASS'];
  const from = process.env['SMTP_FROM'] ?? "noreply@arus.io";

  if (!host || !user || !pass) {
    return null;
  }

  return {
    transport: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
    from,
  };
}

function nextRetryAt(attempt: number): Date {
  const delayMs = Math.min(2 ** attempt * 60_000, 60 * 60_000);
  return new Date(Date.now() + delayMs);
}

/**
 * Age-out stale queue items in one SQL UPDATE. Cheaper than looping, and
 * keeps the subsequent SELECT focused on actually-sendable items.
 *
 * Returns the number of items expired for logging.
 */
async function expireStaleQueueItems(): Promise<number> {
  const cutoff = new Date(Date.now() - MAX_QUEUE_AGE_HOURS * 60 * 60 * 1000);

  const result = await db
    .update(emailQueue)
    .set({
      status: "expired",
      errorMessage: `Expired after ${MAX_QUEUE_AGE_HOURS}h without being sent`,
      lastAttemptAt: new Date(),
    })
    .where(and(eq(emailQueue.status, "pending"), lt(emailQueue.createdAt, cutoff)))
    .returning({ id: emailQueue.id });

  return result.length;
}

async function processEmailBatch(): Promise<void> {
  // Age-out first. If the system was offline or SMTP was unconfigured for
  // a while, we'd rather expire stale items than send them late.
  try {
    const expiredCount = await expireStaleQueueItems();
    if (expiredCount > 0) {
      logger.warn(
        LOG_CTX,
        `Expired ${expiredCount} queue item(s) older than ${MAX_QUEUE_AGE_HOURS}h`
      );
    }
  } catch (err) {
    // Don't let an expiry SQL failure block the batch loop.
    logger.error(
      LOG_CTX,
      `Age-out query failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const mailer = createTransport();

  // If SMTP is unconfigured, expire anything that would otherwise just
  // accumulate in "pending". We do this BEFORE the SELECT so the next
  // iteration doesn't keep re-finding the same items. This is the core
  // of Fix #3: don't let the queue grow silently when nothing can send.
  if (!mailer) {
    try {
      const skippedResult = await db
        .update(emailQueue)
        .set({
          status: "expired",
          errorMessage: "SMTP not configured at time of attempt",
          lastAttemptAt: new Date(),
        })
        .where(eq(emailQueue.status, "pending"))
        .returning({ id: emailQueue.id });

      if (skippedResult.length > 0) {
        logger.warn(
          LOG_CTX,
          `SMTP not configured — expired ${skippedResult.length} pending email(s). ` +
            `Configure SMTP_HOST/SMTP_USER/SMTP_PASS to enable sending.`
        );
      }
    } catch (err) {
      logger.error(
        LOG_CTX,
        `Failed to expire unconfigured-SMTP queue: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    return;
  }

  const pending = await db
    .select()
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.status, "pending"),
        lt(emailQueue.attempts, MAX_ATTEMPTS),
        sql`(${emailQueue.nextRetryAt} IS NULL OR ${emailQueue.nextRetryAt} <= NOW())`
      )
    )
    .orderBy(emailQueue.createdAt)
    .limit(BATCH_SIZE);

  if (pending.length === 0) {
    return;
  }

  logger.info(LOG_CTX, `Processing ${pending.length} queued email(s)`);

  for (const item of pending) {
    try {
      await mailer.transport.sendMail({
        from: mailer.from,
        to: item.recipientEmail,
        subject: item.subject,
        html: item.htmlContent,
      });

      await db
        .update(emailQueue)
        .set({
          status: "sent",
          sentAt: new Date(),
          attempts: sql`${emailQueue.attempts} + 1`,
          lastAttemptAt: new Date(),
        })
        .where(eq(emailQueue.id, item.id));

      logger.info(LOG_CTX, `Sent email ${item.id} to ${item.recipientEmail}`);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      const nextAttempt = (item.attempts || 0) + 1;
      const isDead = nextAttempt >= MAX_ATTEMPTS;

      await db
        .update(emailQueue)
        .set({
          status: isDead ? "dead_letter" : "pending",
          attempts: sql`${emailQueue.attempts} + 1`,
          lastAttemptAt: new Date(),
          errorMessage: errMessage,
          nextRetryAt: isDead ? null : nextRetryAt(nextAttempt),
        })
        .where(eq(emailQueue.id, item.id));

      if (isDead) {
        logger.error(
          LOG_CTX,
          `Email ${item.id} moved to dead_letter after ${MAX_ATTEMPTS} attempts: ${errMessage}`
        );
      } else {
        logger.warn(
          LOG_CTX,
          `Email ${item.id} failed (attempt ${nextAttempt}/${MAX_ATTEMPTS}): ${errMessage}`
        );
      }
    }
  }
}

export async function getDeadLetterEmails(orgId?: string) {
  const conditions: import("drizzle-orm").SQL[] = [eq(emailQueue.status, "dead_letter")];
  if (orgId) {
    conditions.push(eq(emailQueue.orgId, orgId));
  }
  return db
    .select()
    .from(emailQueue)
    .where(and(...conditions))
    .orderBy(emailQueue.createdAt);
}

/**
 * Expired emails — separate query from dead-letter so operators can tell
 * "couldn't send despite trying" (dead_letter) from "didn't try because
 * SMTP was down / item got stale" (expired).
 */
export async function getExpiredEmails(orgId?: string) {
  const conditions: import("drizzle-orm").SQL[] = [eq(emailQueue.status, "expired")];
  if (orgId) {
    conditions.push(eq(emailQueue.orgId, orgId));
  }
  return db
    .select()
    .from(emailQueue)
    .where(and(...conditions))
    .orderBy(emailQueue.createdAt);
}

export async function requeueDeadLetterEmail(id: string): Promise<void> {
  await db
    .update(emailQueue)
    .set({
      status: "pending",
      attempts: 0,
      errorMessage: null,
      nextRetryAt: null,
    })
    .where(and(eq(emailQueue.id, id), eq(emailQueue.status, "dead_letter")));
  logger.info(LOG_CTX, `Requeued dead-letter email ${id}`);
}

/**
 * Requeue an expired email. Typically only useful during testing or if an
 * operator wants to re-send a specific stale alert after determining it's
 * still relevant. Not a bulk operation — expired items are expired for a
 * reason (stale content) and bulk-resurrecting them is exactly the
 * failure mode Fix #3 prevents.
 */
export async function requeueExpiredEmail(id: string): Promise<void> {
  await db
    .update(emailQueue)
    .set({
      status: "pending",
      attempts: 0,
      errorMessage: null,
      nextRetryAt: null,
    })
    .where(and(eq(emailQueue.id, id), eq(emailQueue.status, "expired")));
  logger.info(LOG_CTX, `Requeued expired email ${id}`);
}

export function startEmailWorker(): void {
  if (intervalHandle) {
    logger.warn(LOG_CTX, "Worker already running");
    return;
  }

  logger.info(
    LOG_CTX,
    `Started — polling every ${POLL_INTERVAL_MS / 1000}s, max queue age ${MAX_QUEUE_AGE_HOURS}h`
  );

  processEmailBatch().catch((err) => logger.error(LOG_CTX, `Initial batch failed: ${err}`));

  intervalHandle = setInterval(() => {
    processEmailBatch().catch((err) => logger.error(LOG_CTX, `Batch failed: ${err}`));
  }, POLL_INTERVAL_MS);
}

export function stopEmailWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info(LOG_CTX, "Stopped");
  }
}
