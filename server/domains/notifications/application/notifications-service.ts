/**
 * Notifications Application Service
 * Use-case orchestration for notification settings and the notification queue,
 * depending only on the INotificationRepository port (constructor DI).
 */

import type { INotificationRepository } from "../domain/ports";
import type {
  NotificationSettingsEntity,
  NotificationQueueEntity,
  CreateNotificationSettingsCommand,
  UpdateNotificationSettingsCommand,
  CreateNotificationQueueCommand,
} from "../domain/types";

export class NotificationsApplicationService {
  constructor(private readonly repository: INotificationRepository) {}

  // ===== Settings =====

  listSettings(orgId: string): Promise<NotificationSettingsEntity[]> {
    return this.repository.listSettings(orgId);
  }

  async getSettingById(orgId: string, id: string): Promise<NotificationSettingsEntity | undefined> {
    const all = await this.repository.listSettings(orgId);
    return all.find((s) => s.id === id);
  }

  createSettings(data: CreateNotificationSettingsCommand): Promise<NotificationSettingsEntity> {
    return this.repository.createSettings(data);
  }

  updateSettings(
    id: string,
    updates: UpdateNotificationSettingsCommand,
    orgId: string
  ): Promise<NotificationSettingsEntity> {
    return this.repository.updateSettings(id, updates, orgId);
  }

  deleteSettings(id: string, orgId: string): Promise<void> {
    return this.repository.deleteSettings(id, orgId);
  }

  // ===== Queue =====

  listQueue(status: string | undefined, orgId: string): Promise<NotificationQueueEntity[]> {
    return this.repository.listQueue(status, orgId);
  }

  createQueueItem(item: CreateNotificationQueueCommand): Promise<NotificationQueueEntity> {
    return this.repository.createQueueItem(item);
  }

  deleteQueueItem(id: string, orgId: string): Promise<void> {
    return this.repository.deleteQueueItem(id, orgId);
  }
}
