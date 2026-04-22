/**
 * Alerts Storage Interface - Alert Configurations, Notifications, Suppressions
 * Part of IStorage modularization for improved maintainability
 */

import type {
  AlertConfiguration,
  InsertAlertConfiguration as InsertAlertConfig,
  AlertNotification,
  InsertAlertNotification,
  AlertSuppression,
  InsertAlertSuppression,
  AlertComment,
  InsertAlertComment,
  CrewNotificationSettings as NotificationSetting,
  InsertCrewNotificationSettings as InsertNotificationSetting,
  NotificationQueue as NotificationQueueItem,
  InsertNotificationQueue as InsertNotificationQueueItem,
} from "@shared/schema";

/**
 * Alert storage operations for configurations, notifications, and suppressions
 */
export interface IAlertsStorage {
  // Alert Configurations
  getAlertConfigurations(equipmentId?: string): Promise<AlertConfiguration[]>;
  createAlertConfiguration(config: InsertAlertConfig): Promise<AlertConfiguration>;
  updateAlertConfiguration(
    id: string,
    config: Partial<InsertAlertConfig>
  ): Promise<AlertConfiguration>;
  deleteAlertConfiguration(id: string): Promise<void>;

  // Alert Notifications
  getAlertNotifications(acknowledged?: boolean, orgId?: string): Promise<AlertNotification[]>;
  getAlertNotificationsPaginated(
    acknowledged: boolean | undefined,
    orgId: string | undefined,
    limit: number,
    offset: number
  ): Promise<{ items: AlertNotification[]; total: number }>;
  createAlertNotification(notification: InsertAlertNotification): Promise<AlertNotification>;
  acknowledgeAlert(id: string, acknowledgedBy: string): Promise<AlertNotification>;
  hasRecentAlert(
    equipmentId: string,
    sensorType: string,
    alertType: string,
    minutesBack?: number
  ): Promise<boolean>;
  clearAllAlerts(): Promise<void>;

  // Alert Comments
  addAlertComment(commentData: InsertAlertComment): Promise<AlertComment>;
  getAlertComments(alertId: string): Promise<AlertComment[]>;

  // Alert Suppressions
  createAlertSuppression(suppressionData: InsertAlertSuppression): Promise<AlertSuppression>;
  getActiveSuppressions(orgId?: string): Promise<AlertSuppression[]>;
  removeAlertSuppression(id: string): Promise<void>;
  isAlertSuppressed(equipmentId: string, sensorType: string, alertType: string): Promise<boolean>;

  // Notification Settings
  getNotificationSettings(
    orgId: string,
    filters?: { vesselId?: string; notificationType?: string }
  ): Promise<NotificationSetting[]>;
  getNotificationSettingById(id: string, orgId: string): Promise<NotificationSetting | undefined>;
  createNotificationSetting(setting: InsertNotificationSetting): Promise<NotificationSetting>;
  updateNotificationSetting(
    id: string,
    setting: Partial<InsertNotificationSetting>,
    orgId: string
  ): Promise<NotificationSetting>;
  deleteNotificationSetting(id: string, orgId: string): Promise<void>;

  // Notification Queue
  getNotificationQueue(
    orgId: string,
    filters?: { status?: string; notificationType?: string; scheduledBefore?: Date }
  ): Promise<NotificationQueueItem[]>;
  getNotificationQueueById(id: string, orgId: string): Promise<NotificationQueueItem | undefined>;
  createNotificationQueueItem(item: InsertNotificationQueueItem): Promise<NotificationQueueItem>;
  updateNotificationQueueItem(
    id: string,
    item: Partial<InsertNotificationQueueItem>,
    orgId: string
  ): Promise<NotificationQueueItem>;
  markNotificationSent(id: string, orgId: string): Promise<NotificationQueueItem>;
  markNotificationFailed(id: string, error: string, orgId: string): Promise<NotificationQueueItem>;
  deleteNotificationQueueItem(id: string, orgId: string): Promise<void>;
}
