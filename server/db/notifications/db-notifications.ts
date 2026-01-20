/**
 * Notifications - Database Storage
 */

import { eq, and, desc, gte, lte, isNull, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { notificationSettings, emailQueue, notificationHistory, type NotificationSettings, type InsertNotificationSettings, type EmailQueue, type InsertEmailQueue, type NotificationHistory, type InsertNotificationHistory } from "@shared/schema-runtime";

export class DatabaseNotificationsStorage {
  async getNotificationSettings(orgId?: string, userId?: string): Promise<NotificationSettings[]> { const conditions = []; if (orgId) {conditions.push(eq(notificationSettings.orgId, orgId));} if (userId) {conditions.push(eq(notificationSettings.userId, userId));} let query = db.select().from(notificationSettings); if (conditions.length > 0) {query = query.where(and(...conditions));} return query; }
  async getNotificationSettingsForUser(userId: string): Promise<NotificationSettings | undefined> { const [result] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1); return result; }
  async createNotificationSettings(settings: InsertNotificationSettings): Promise<NotificationSettings> { const [n] = await db.insert(notificationSettings).values(settings).returning(); return n; }
  async updateNotificationSettings(id: string, updates: Partial<InsertNotificationSettings>): Promise<NotificationSettings> { const [u] = await db.update(notificationSettings).set({ ...updates, updatedAt: new Date() }).where(eq(notificationSettings.id, id)).returning(); if (!u) {throw new Error(`Notification settings ${id} not found`);} return u; }
  async deleteNotificationSettings(id: string): Promise<void> { await db.delete(notificationSettings).where(eq(notificationSettings.id, id)); }

  async getEmailQueue(status?: string, limit?: number): Promise<EmailQueue[]> { let query = db.select().from(emailQueue); if (status) {query = query.where(eq(emailQueue.status, status));} query = query.orderBy(emailQueue.priority, emailQueue.createdAt); if (limit) {query = query.limit(limit);} return query; }
  async getEmailQueueItem(id: string): Promise<EmailQueue | undefined> { const [result] = await db.select().from(emailQueue).where(eq(emailQueue.id, id)); return result; }
  async createEmailQueueItem(item: InsertEmailQueue): Promise<EmailQueue> { const [n] = await db.insert(emailQueue).values(item).returning(); return n; }
  async updateEmailQueueItem(id: string, updates: Partial<InsertEmailQueue>): Promise<EmailQueue> { const [u] = await db.update(emailQueue).set({ ...updates, updatedAt: new Date() }).where(eq(emailQueue.id, id)).returning(); if (!u) {throw new Error(`Email queue item ${id} not found`);} return u; }
  async deleteEmailQueueItem(id: string): Promise<void> { await db.delete(emailQueue).where(eq(emailQueue.id, id)); }
  async getPendingEmails(limit?: number): Promise<EmailQueue[]> { let query = db.select().from(emailQueue).where(eq(emailQueue.status, 'pending')).orderBy(emailQueue.priority, emailQueue.createdAt); if (limit) {query = query.limit(limit);} return query; }
  async markEmailSent(id: string): Promise<void> { await db.update(emailQueue).set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() }).where(eq(emailQueue.id, id)); }
  async markEmailFailed(id: string, error: string): Promise<void> { const [item] = await db.select().from(emailQueue).where(eq(emailQueue.id, id)); if (item) {await db.update(emailQueue).set({ status: 'failed', error, retryCount: (item.retryCount || 0) + 1, updatedAt: new Date() }).where(eq(emailQueue.id, id));} }

  async getNotificationHistory(userId?: string, type?: string, fromDate?: Date, toDate?: Date): Promise<NotificationHistory[]> { const conditions = []; if (userId) {conditions.push(eq(notificationHistory.userId, userId));} if (type) {conditions.push(eq(notificationHistory.type, type));} if (fromDate) {conditions.push(gte(notificationHistory.createdAt, fromDate));} if (toDate) {conditions.push(lte(notificationHistory.createdAt, toDate));} let query = db.select().from(notificationHistory); if (conditions.length > 0) {query = query.where(and(...conditions));} return query.orderBy(sql`${notificationHistory.createdAt} DESC`); }
  async createNotificationHistory(notification: InsertNotificationHistory): Promise<NotificationHistory> { const [n] = await db.insert(notificationHistory).values(notification).returning(); return n; }
  async markNotificationRead(id: string): Promise<void> { await db.update(notificationHistory).set({ readAt: new Date() }).where(eq(notificationHistory.id, id)); }
  async markAllNotificationsRead(userId: string): Promise<void> { await db.update(notificationHistory).set({ readAt: new Date() }).where(and(eq(notificationHistory.userId, userId), isNull(notificationHistory.readAt))); }
  async getUnreadNotificationCount(userId: string): Promise<number> { const unread = await db.select().from(notificationHistory).where(and(eq(notificationHistory.userId, userId), isNull(notificationHistory.readAt))); return unread.length; }
  async deleteOldNotifications(beforeDate: Date): Promise<number> { const result = await db.delete(notificationHistory).where(lte(notificationHistory.createdAt, beforeDate)); return result.rowCount || 0; }
}
