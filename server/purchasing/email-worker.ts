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
 */

import { db } from "../db";
import { eq, and, lte, lt, sql } from "drizzle-orm";
import { emailQueue } from "@shared/schema";
import { logger } from "../utils/logger";
import nodemailer from "nodemailer";

const LOG_CTX = "EmailWorker";

const POLL_INTERVAL_MS  = 30_000;
const MAX_ATTEMPTS      = 5;
const BATCH_SIZE        = 10;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "noreply@arus.io";

  if (!host || !user || !pass) {
    logger.warn(LOG_CTX, "SMTP credentials not configured — email sending disabled");
    return null;
  }

  return {
    transport: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }),
    from,
  };
}

function nextRetryAt(attempt: number): Date {
  const delayMs = Math.min(2 ** attempt * 60_000, 60 * 60_000);
  return new Date(Date.now() + delayMs);
}

async function processEmailBatch(): Promise<void> {
  const mailer = createTransport();

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

  if (pending.length === 0) return;

  logger.info(LOG_CTX, `Processing ${pending.length} queued email(s)`);

  for (const item of pending) {
    try {
      if (!mailer) {
        logger.warn(LOG_CTX, `Skipping email ${item.id} — SMTP not configured`);
        continue;
      }

      await mailer.transport.sendMail({
        from:    mailer.from,
        to:      item.recipientEmail,
        subject: item.subject,
        html:    item.htmlContent,
      });

      await db
        .update(emailQueue)
        .set({
          status:        "sent",
          sentAt:        new Date(),
          attempts:      sql`${emailQueue.attempts} + 1`,
          lastAttemptAt: new Date(),
        })
        .where(eq(emailQueue.id, item.id));

      logger.info(LOG_CTX, `Sent email ${item.id} to ${item.recipientEmail}`);

    } catch (err) {
      const errMessage  = err instanceof Error ? err.message : String(err);
      const nextAttempt = (item.attempts || 0) + 1;
      const isDead      = nextAttempt >= MAX_ATTEMPTS;

      await db
        .update(emailQueue)
        .set({
          status:        isDead ? "dead_letter" : "pending",
          attempts:      sql`${emailQueue.attempts} + 1`,
          lastAttemptAt: new Date(),
          errorMessage:  errMessage,
          nextRetryAt:   isDead ? null : nextRetryAt(nextAttempt),
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
  const conditions: any[] = [eq(emailQueue.status, "dead_letter")];
  if (orgId) conditions.push(eq(emailQueue.orgId, orgId));
  return db.select().from(emailQueue).where(and(...conditions)).orderBy(emailQueue.createdAt);
}

export async function requeueDeadLetterEmail(id: string): Promise<void> {
  await db
    .update(emailQueue)
    .set({ status: "pending", attempts: 0, errorMessage: null, nextRetryAt: null })
    .where(and(eq(emailQueue.id, id), eq(emailQueue.status, "dead_letter")));
  logger.info(LOG_CTX, `Requeued dead-letter email ${id}`);
}

export function startEmailWorker(): void {
  if (intervalHandle) {
    logger.warn(LOG_CTX, "Worker already running");
    return;
  }

  logger.info(LOG_CTX, `Started — polling every ${POLL_INTERVAL_MS / 1000}s`);

  processEmailBatch().catch((err) =>
    logger.error(LOG_CTX, `Initial batch failed: ${err}`)
  );

  intervalHandle = setInterval(() => {
    processEmailBatch().catch((err) =>
      logger.error(LOG_CTX, `Batch failed: ${err}`)
    );
  }, POLL_INTERVAL_MS);
}

export function stopEmailWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info(LOG_CTX, "Stopped");
  }
}
