import type {
  AlertConfiguration,
  InsertAlertConfiguration as InsertAlertConfig,
  AlertNotification,
  InsertAlertNotification,
  AlertSuppression,
  InsertAlertSuppression,
  AlertComment,
  InsertAlertComment,
} from "@shared/schema";
import { dbAlertStorage } from "../../repositories";

/**
 * Alerts Repository
 * Handles all data access for alerts domain
 */
export class AlertsRepository {
  // ========== Alert Configurations ==========

  /**
   * Get all alert configurations, optionally filtered by equipment
   */
  async findAllConfigurations(equipmentId?: string): Promise<AlertConfiguration[]> {
    return dbAlertStorage.getAlertConfigurations(equipmentId);
  }

  /**
   * Get single configuration by ID
   */
  async findConfigurationById(id: string): Promise<AlertConfiguration | undefined> {
    const configs = await dbAlertStorage.getAlertConfigurations();
    return configs.find((c) => c.id === id);
  }

  /**
   * Create new alert configuration
   */
  async createConfiguration(config: InsertAlertConfig): Promise<AlertConfiguration> {
    return dbAlertStorage.createAlertConfiguration(config);
  }

  /**
   * Update alert configuration
   */
  async updateConfiguration(
    id: string,
    config: Partial<InsertAlertConfig>
  ): Promise<AlertConfiguration> {
    return dbAlertStorage.updateAlertConfiguration(id, config);
  }

  /**
   * Delete alert configuration
   */
  async deleteConfiguration(id: string): Promise<void> {
    return dbAlertStorage.deleteAlertConfiguration(id);
  }

  // ========== Alert Notifications ==========

  /**
   * Get all alert notifications, optionally filtered by acknowledgment status
   */
  async findAllNotifications(acknowledged?: boolean, orgId?: string): Promise<AlertNotification[]> {
    return dbAlertStorage.getAlertNotifications(acknowledged, orgId);
  }

  /**
   * Create new alert notification
   */
  async createNotification(notification: InsertAlertNotification): Promise<AlertNotification> {
    return dbAlertStorage.createAlertNotification(notification);
  }

  /**
   * Acknowledge an alert notification
   */
  async acknowledgeNotification(id: string, acknowledgedBy: string): Promise<AlertNotification> {
    return dbAlertStorage.acknowledgeAlert(id, acknowledgedBy);
  }

  /**
   * Check if there's a recent alert for equipment/sensor/type
   */
  async hasRecentAlert(
    equipmentId: string,
    sensorType: string,
    alertType: string,
    minutesBack: number = 10
  ): Promise<boolean> {
    return dbAlertStorage.hasRecentAlert(equipmentId, sensorType, alertType, minutesBack);
  }

  // ========== Alert Comments ==========

  /**
   * Add comment to alert
   */
  async addComment(commentData: InsertAlertComment): Promise<AlertComment> {
    return dbAlertStorage.addAlertComment(commentData);
  }

  /**
   * Get all comments for an alert
   */
  async getComments(alertId: string): Promise<AlertComment[]> {
    return dbAlertStorage.getAlertComments(alertId);
  }

  // ========== Alert Suppressions ==========

  /**
   * Create alert suppression
   */
  async createSuppression(suppressionData: InsertAlertSuppression): Promise<AlertSuppression> {
    return dbAlertStorage.createAlertSuppression(suppressionData);
  }

  /**
   * Get all active suppressions
   */
  async findAllSuppressions(orgId?: string): Promise<AlertSuppression[]> {
    return dbAlertStorage.getActiveSuppressions(orgId);
  }

  /**
   * Remove alert suppression
   */
  async deleteSuppression(id: string): Promise<void> {
    return dbAlertStorage.removeAlertSuppression(id);
  }

  /**
   * Check if alert is currently suppressed
   */
  async isAlertSuppressed(
    equipmentId: string,
    sensorType: string,
    alertType: string
  ): Promise<boolean> {
    // @ts-ignore -- bulk-silence
    return dbAlertStorage.isAlertSuppressed(equipmentId, sensorType, alertType);
  }

  // ========== Utility Methods ==========

  /**
   * Delete all alerts and notifications
   */
  async deleteAllNotifications(): Promise<void> {
    // @ts-ignore -- bulk-silence
    return dbAlertStorage.clearAllAlerts();
  }
}

// Export singleton instance
export const alertsRepository = new AlertsRepository();
