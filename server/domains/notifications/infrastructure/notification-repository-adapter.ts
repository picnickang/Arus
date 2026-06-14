/**
 * Notifications Infrastructure - Repository Adapter
 * Implements INotificationRepository using dbNotificationsStorage. This is the
 * only notifications layer permitted to touch the storage barrel.
 */

import type { INotificationRepository } from "../domain/ports";
import type {
  NotificationSettingsEntity,
  NotificationQueueEntity,
  CreateNotificationSettingsCommand,
  UpdateNotificationSettingsCommand,
  CreateNotificationQueueCommand,
} from "../domain/types";
import { dbNotificationsStorage } from "../../../repositories";

export class NotificationRepositoryAdapter implements INotificationRepository {
  listSettings(orgId: string): Promise<NotificationSettingsEntity[]> {
    return dbNotificationsStorage.getNotificationSettings(orgId);
  }

  createSettings(data: CreateNotificationSettingsCommand): Promise<NotificationSettingsEntity> {
    return dbNotificationsStorage.createNotificationSettings(data);
  }

  updateSettings(
    id: string,
    updates: UpdateNotificationSettingsCommand,
    orgId: string
  ): Promise<NotificationSettingsEntity> {
    return dbNotificationsStorage.updateNotificationSettings(id, updates, orgId);
  }

  deleteSettings(id: string, orgId: string): Promise<void> {
    return dbNotificationsStorage.deleteNotificationSettings(id, orgId);
  }

  listQueue(status: string | undefined, orgId: string): Promise<NotificationQueueEntity[]> {
    return dbNotificationsStorage.getNotificationQueue(status, undefined, orgId);
  }

  createQueueItem(item: CreateNotificationQueueCommand): Promise<NotificationQueueEntity> {
    return dbNotificationsStorage.createNotificationQueueItem(item);
  }

  deleteQueueItem(id: string, orgId: string): Promise<void> {
    return dbNotificationsStorage.deleteNotificationQueueItem(id, orgId);
  }
}

export const notificationRepository = new NotificationRepositoryAdapter();
