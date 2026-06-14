/**
 * Email Notification - Queue Processing
 *
 * Operates on the notification_queue table (recipients[]/bodyHtml/
 * attemptCount/lastError/scheduledFor) — distinct from email_queue
 * (single recipientEmail/htmlContent/attempts/errorMessage) which the
 * purchasing email worker uses.
 */

import { dbNotificationsStorage } from "../../repositories.js";
import type {
  NotificationQueue as NotificationQueueItem,
  InsertNotificationQueue as InsertNotificationQueueItem,
} from "@shared/schema";
import { format } from "date-fns";
import { log, calculateBackoff } from "./logger.js";
import { emailSender } from "./email-sender.js";

export async function queueNotification(
  item: InsertNotificationQueueItem
): Promise<NotificationQueueItem> {
  return dbNotificationsStorage.createNotificationQueueItem(item);
}

export async function processQueueItem(item: NotificationQueueItem): Promise<void> {
  const currentAttempt = (item.attemptCount ?? 0) + 1;
  const maxAttempts = Number.parseInt(process.env["EMAIL_MAX_RETRIES"] || "3", 10) + 1;
  const retryConfig = emailSender.getRetryConfig();

  const result = await emailSender.sendEmail(
    {
      to: item.recipients as string[],
      subject: item.subject,
      text: item.body,
      html: item.bodyHtml || undefined,
    },
    item.orgId
  );

  if (result.success) {
    await dbNotificationsStorage.updateNotificationQueueItem(
      item.id,
      {
        status: "sent",
        attemptCount: currentAttempt,
        lastAttemptAt: new Date(),
        lastError: null,
        sentAt: new Date(),
      },
      item.orgId
    );
    return;
  }

  const shouldRetry = result.retriable && currentAttempt < maxAttempts;

  if (shouldRetry) {
    const backoffMs = calculateBackoff(currentAttempt - 1, retryConfig);
    log("info", "Scheduling email retry", {
      itemId: item.id,
      attempt: currentAttempt,
      maxAttempts,
      backoffMs,
    });

    await dbNotificationsStorage.updateNotificationQueueItem(
      item.id,
      {
        status: "pending",
        attemptCount: currentAttempt,
        lastAttemptAt: new Date(),
        lastError: result.error || null,
        scheduledFor: new Date(Date.now() + backoffMs),
      },
      item.orgId
    );
  } else {
    log("error", "Email send failed permanently", {
      itemId: item.id,
      attempt: currentAttempt,
      maxAttempts,
      error: result.error,
    });

    await dbNotificationsStorage.updateNotificationQueueItem(
      item.id,
      {
        status: "failed",
        attemptCount: currentAttempt,
        lastAttemptAt: new Date(),
        lastError: result.error || null,
      },
      item.orgId
    );
  }
}

export async function processDigestQueue(): Promise<number> {
  const now = new Date();
  const pendingItems = await dbNotificationsStorage.getNotificationQueue("pending");

  const digestItems = pendingItems.filter(
    (item) => item.scheduledFor && new Date(item.scheduledFor) <= now
  );

  let processedCount = 0;
  const itemsByRecipient = new Map<string, NotificationQueueItem[]>();

  for (const item of digestItems) {
    const key = `${item.orgId}_${(item.recipients as string[]).sort((a, b) => a.localeCompare(b)).join(",")}`;
    if (!itemsByRecipient.has(key)) {
      itemsByRecipient.set(key, []);
    }
    itemsByRecipient.get(key)!.push(item);
  }

  for (const [, items] of itemsByRecipient) {
    if (items.length === 1) {
      await processQueueItem(items[0]!);
      processedCount++;
      continue;
    }

    const digestSubject = `ARUS Marine Daily Compliance Digest - ${format(now, "yyyy-MM-dd")}`;
    const digestText = items.map((item) => `---\n${item.subject}\n\n${item.body}`).join("\n\n");
    const digestHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Daily Compliance Digest</h1>
        <p>Date: ${format(now, "MMMM d, yyyy")}</p>
        <p>You have ${items.length} compliance items requiring attention:</p>
        <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
        ${items.map((item) => `<div style="margin-bottom: 20px;">${item.bodyHtml || item.body}</div>`).join("")}
        <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">This is an automated digest from ARUS Marine.</p>
      </div>
    `;

    const result = await emailSender.sendEmail(
      {
        to: items[0]!.recipients as string[],
        subject: digestSubject,
        text: digestText,
        html: digestHtml,
      },
      items[0]!.orgId
    );

    for (const item of items) {
      await dbNotificationsStorage.updateNotificationQueueItem(
        item.id,
        {
          status: result.success ? "sent" : "failed",
          attemptCount: (item.attemptCount ?? 0) + 1,
          lastAttemptAt: now,
          lastError: result.error || null,
          sentAt: result.success ? now : null,
        },
        item.orgId
      );
      processedCount++;
    }
  }

  return processedCount;
}

export async function retryFailedNotifications(maxAttempts: number = 3): Promise<number> {
  const failedItems = await dbNotificationsStorage.getNotificationQueue("failed");
  const retriable = failedItems.filter((item) => (item.attemptCount ?? 0) < maxAttempts);
  let retryCount = 0;

  for (const item of retriable) {
    await processQueueItem(item);
    retryCount++;
  }

  return retryCount;
}
