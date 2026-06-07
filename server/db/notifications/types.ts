/**
 * Notifications - Types
 */

import type { notificationSettings } from "@shared/schema-runtime";

export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = typeof notificationSettings.$inferInsert;
export type { EmailQueue, InsertEmailQueue } from "@shared/schema-runtime";
