/**
 * Notifications - Database Storage
 */

import { eq, and } from "drizzle-orm";
import { db } from "../../db-config";
import { notificationSettings } from "@shared/schema-runtime";
import type {
  OrgNotificationSettings as NotificationSettings,
  InsertOrgNotificationSettings as InsertNotificationSettings,
} from "@shared/schema";
import { emailQueue, type EmailQueue, type InsertEmailQueue } from "@shared/schema";

export class DatabaseNotificationsStorage {
  async getNotificationSettings(orgId?: string, userId?: string): Promise<NotificationSettings[]> {
    // NOTE: userId filter is ignored — notification_settings is org-scoped only
    // (no user_id column in shared/schema/admin.ts). Kept in signature for compat.
    void userId;
    const conditions = [];
    if (orgId) {
      conditions.push(eq(notificationSettings.orgId, orgId));
    }
    let query = db.select().from(notificationSettings).$dynamic();
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    return query;
  }
  async getNotificationSettingsForUser(userId: string): Promise<NotificationSettings | undefined> {
    // NOTE: notification_settings has no user_id column; per-user lookup is unsupported.
    // Returns undefined so callers fall back to org defaults.
    void userId;
    return undefined;
  }
  async createNotificationSettings(
    settings: InsertNotificationSettings
  ): Promise<NotificationSettings> {
    const [n] = await db.insert(notificationSettings).values(settings).returning();
    return n;
  }
  async updateNotificationSettings(
    id: string,
    updates: Partial<InsertNotificationSettings>,
    orgId?: string
  ): Promise<NotificationSettings> {
    const conditions = orgId
      ? and(eq(notificationSettings.id, id), eq(notificationSettings.orgId, orgId))
      : eq(notificationSettings.id, id);
    const [u] = await db
      .update(notificationSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(conditions)
      .returning();
    if (!u) {
      throw new Error(`Notification settings ${id} not found`);
    }
    return u;
  }
  async deleteNotificationSettings(id: string, orgId?: string): Promise<void> {
    const conditions = orgId
      ? and(eq(notificationSettings.id, id), eq(notificationSettings.orgId, orgId))
      : eq(notificationSettings.id, id);
    await db.delete(notificationSettings).where(conditions);
  }

  async getEmailQueue(status?: string, limit?: number, orgId?: string): Promise<EmailQueue[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(emailQueue.orgId, orgId));
    }
    if (status) {
      conditions.push(eq(emailQueue.status, status));
    }
    if (conditions.length > 0) {
      let q = db
        .select()
        .from(emailQueue)
        .where(and(...conditions))
        .orderBy(emailQueue.createdAt)
        .$dynamic();
      if (limit) {
        q = q.limit(limit);
      }
      return q;
    }
    let q = db.select().from(emailQueue).orderBy(emailQueue.createdAt).$dynamic();
    if (limit) {
      q = q.limit(limit);
    }
    return q;
  }
  async getEmailQueueItem(id: string, orgId?: string): Promise<EmailQueue | undefined> {
    const conditions = orgId
      ? and(eq(emailQueue.id, id), eq(emailQueue.orgId, orgId))
      : eq(emailQueue.id, id);
    const [result] = await db.select().from(emailQueue).where(conditions);
    return result;
  }
  async createEmailQueueItem(item: InsertEmailQueue): Promise<EmailQueue> {
    const [n] = await db.insert(emailQueue).values(item).returning();
    return n;
  }
  async updateEmailQueueItem(
    id: string,
    updates: Partial<InsertEmailQueue>,
    orgId?: string
  ): Promise<EmailQueue> {
    const conditions = orgId
      ? and(eq(emailQueue.id, id), eq(emailQueue.orgId, orgId))
      : eq(emailQueue.id, id);
    const [u] = await db.update(emailQueue).set(updates).where(conditions).returning();
    if (!u) {
      throw new Error(`Email queue item ${id} not found`);
    }
    return u;
  }
  async deleteEmailQueueItem(id: string, orgId?: string): Promise<void> {
    const conditions = orgId
      ? and(eq(emailQueue.id, id), eq(emailQueue.orgId, orgId))
      : eq(emailQueue.id, id);
    await db.delete(emailQueue).where(conditions);
  }
  async getPendingEmails(limit?: number): Promise<EmailQueue[]> {
    let query = db
      .select()
      .from(emailQueue)
      .where(eq(emailQueue.status, "pending"))
      .orderBy(emailQueue.createdAt)
      .$dynamic();
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  async markEmailSent(id: string): Promise<void> {
    await db
      .update(emailQueue)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(emailQueue.id, id));
  }
  async markEmailFailed(id: string, error: string): Promise<void> {
    const [item] = await db.select().from(emailQueue).where(eq(emailQueue.id, id));
    if (item) {
      await db
        .update(emailQueue)
        .set({
          status: "failed",
          errorMessage: error,
          attempts: ((item as any).attempts || 0) + 1,
        })
        .where(eq(emailQueue.id, id));
    }
  }
}
