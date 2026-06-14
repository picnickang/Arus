/**
 * Alerts Infrastructure - Repository Adapter
 * Implements IAlertRepository using the storage layer (dbAlertStorage).
 * This is the only alerts layer permitted to touch server/repositories.
 */

import type { WidenPartial } from "../../../lib/widen-partial";
import type { IAlertRepository } from "../domain/ports";
import type {
  AlertConfigurationEntity,
  AlertNotificationEntity,
  AlertSuppressionEntity,
  AlertCommentEntity,
  CreateAlertConfigurationCommand,
  CreateAlertNotificationCommand,
  CreateAlertSuppressionCommand,
  CreateAlertCommentCommand,
} from "../domain/types";
import { dbAlertStorage } from "../../../repositories";

export class AlertRepositoryAdapter implements IAlertRepository {
  // ========== Alert Configurations ==========

  async findAllConfigurations(equipmentId?: string): Promise<AlertConfigurationEntity[]> {
    return dbAlertStorage.getAlertConfigurations(equipmentId);
  }

  async findConfigurationById(id: string): Promise<AlertConfigurationEntity | undefined> {
    const configs = await dbAlertStorage.getAlertConfigurations();
    return configs.find((c) => c.id === id);
  }

  async createConfiguration(
    config: CreateAlertConfigurationCommand
  ): Promise<AlertConfigurationEntity> {
    return dbAlertStorage.createAlertConfiguration(config);
  }

  async updateConfiguration(
    id: string,
    config: WidenPartial<CreateAlertConfigurationCommand>
  ): Promise<AlertConfigurationEntity> {
    return dbAlertStorage.updateAlertConfiguration(id, config);
  }

  async deleteConfiguration(id: string): Promise<void> {
    return dbAlertStorage.deleteAlertConfiguration(id);
  }

  // ========== Alert Notifications ==========

  async findAllNotifications(
    acknowledged?: boolean,
    orgId?: string
  ): Promise<AlertNotificationEntity[]> {
    return dbAlertStorage.getAlertNotifications(acknowledged, orgId);
  }

  async createNotification(
    notification: CreateAlertNotificationCommand
  ): Promise<AlertNotificationEntity> {
    return dbAlertStorage.createAlertNotification(notification);
  }

  async acknowledgeNotification(
    id: string,
    acknowledgedBy: string
  ): Promise<AlertNotificationEntity> {
    return dbAlertStorage.acknowledgeAlert(id, acknowledgedBy);
  }

  async hasRecentAlert(
    equipmentId: string,
    sensorType: string,
    alertType: string,
    minutesBack: number = 10
  ): Promise<boolean> {
    return dbAlertStorage.hasRecentAlert(equipmentId, sensorType, alertType, minutesBack);
  }

  // ========== Alert Comments ==========

  async addComment(commentData: CreateAlertCommentCommand): Promise<AlertCommentEntity> {
    return dbAlertStorage.addAlertComment(commentData);
  }

  async getComments(alertId: string): Promise<AlertCommentEntity[]> {
    return dbAlertStorage.getAlertComments(alertId);
  }

  // ========== Alert Suppressions ==========

  async createSuppression(
    suppressionData: CreateAlertSuppressionCommand
  ): Promise<AlertSuppressionEntity> {
    return dbAlertStorage.createAlertSuppression(suppressionData);
  }

  async findAllSuppressions(orgId?: string): Promise<AlertSuppressionEntity[]> {
    return dbAlertStorage.getActiveSuppressions(orgId);
  }

  async deleteSuppression(id: string): Promise<void> {
    return dbAlertStorage.removeAlertSuppression(id);
  }

  async isAlertSuppressed(
    equipmentId: string,
    sensorType: string,
    alertType: string,
    orgId: string
  ): Promise<boolean> {
    return dbAlertStorage.isAlertSuppressed(equipmentId, sensorType, alertType, orgId);
  }

  // ========== Utility Methods ==========

  async deleteAllNotifications(): Promise<void> {
    const store = dbAlertStorage as object as { clearAllAlerts?: () => Promise<void> };
    if (typeof store.clearAllAlerts === "function") {
      await store.clearAllAlerts();
    }
  }
}

export const alertRepository = new AlertRepositoryAdapter();
