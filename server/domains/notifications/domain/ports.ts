/**
 * Notifications Domain - Ports
 *
 * Contract the application layer depends on; the concrete adapter (wrapping
 * dbNotificationsStorage) lives in infrastructure/.
 */

import type {
  NotificationSettingsEntity,
  NotificationQueueEntity,
  CreateNotificationSettingsCommand,
  UpdateNotificationSettingsCommand,
  CreateNotificationQueueCommand,
} from "./types";

export interface INotificationRepository {
  // Settings
  listSettings(orgId: string): Promise<NotificationSettingsEntity[]>;
  createSettings(data: CreateNotificationSettingsCommand): Promise<NotificationSettingsEntity>;
  updateSettings(
    id: string,
    updates: UpdateNotificationSettingsCommand,
    orgId: string
  ): Promise<NotificationSettingsEntity>;
  deleteSettings(id: string, orgId: string): Promise<void>;

  // Queue
  listQueue(status: string | undefined, orgId: string): Promise<NotificationQueueEntity[]>;
  createQueueItem(item: CreateNotificationQueueCommand): Promise<NotificationQueueEntity>;
  deleteQueueItem(id: string, orgId: string): Promise<void>;
}
