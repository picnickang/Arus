/**
 * Alert Settings - Email Logs
 * Email logging and tracking
 */

import { db } from "../../../db.js";
import { alertEmailLog, type AlertEmailLog, type InsertAlertEmailLog } from "@shared/schema";
import { eq, and, gte, sql, lte } from "drizzle-orm";
import type { EmailLogOptions } from "./types.js";

export async function logEmail(data: InsertAlertEmailLog): Promise<AlertEmailLog> {
  const [created] = await db.insert(alertEmailLog).values(data).returning();
  if (!created) {
    throw new Error("Failed to log alert email");
  }
  return created;
}

export async function updateEmailLogStatus(
  id: string,
  status: string,
  sentAt?: Date | null,
  errorMessage?: string | null,
  messageId?: string | null
): Promise<AlertEmailLog> {
  const [updated] = await db
    .update(alertEmailLog)
    .set({ status, sentAt, errorMessage, messageId })
    .where(eq(alertEmailLog.id, id))
    .returning();
  if (!updated) {
    throw new Error(`Failed to update alert email log ${id}`);
  }
  return updated;
}

/**
 * Update delivery status of alert_email_log rows by their SendGrid messageId
 * (used by the event-webhook receiver). Returns the number of rows updated
 * (0 when the messageId is unknown — e.g. an email this system didn't log).
 */
export async function updateEmailLogStatusByMessageId(
  messageId: string,
  status: string,
  errorMessage?: string | null
): Promise<number> {
  const result = await db
    .update(alertEmailLog)
    .set({ status, errorMessage: errorMessage ?? null })
    .where(eq(alertEmailLog.messageId, messageId));
  return result.rowCount ?? 0;
}

export async function getEmailLogs(
  orgId: string,
  options?: EmailLogOptions
): Promise<AlertEmailLog[]> {
  const conditions = [eq(alertEmailLog.orgId, orgId)];
  if (options?.vesselId) {
    conditions.push(eq(alertEmailLog.vesselId, options.vesselId));
  }
  if (options?.alertType) {
    conditions.push(eq(alertEmailLog.alertType, options.alertType));
  }
  if (options?.alertKey) {
    conditions.push(eq(alertEmailLog.alertKey, options.alertKey));
  }
  if (options?.status) {
    conditions.push(eq(alertEmailLog.status, options.status));
  }
  if (options?.startDate) {
    conditions.push(gte(alertEmailLog.createdAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(alertEmailLog.createdAt, options.endDate));
  }

  return db
    .select()
    .from(alertEmailLog)
    .where(and(...conditions))
    .orderBy(sql`${alertEmailLog.createdAt} DESC`)
    .limit(options?.limit || 100)
    .offset(options?.offset || 0);
}
