import type {
  AlertConfiguration,
  InsertAlertConfig,
  AlertNotification,
  InsertAlertNotification,
  AlertSuppression,
  InsertAlertSuppression,
  AlertComment,
  InsertAlertComment,
} from "@shared/schema-runtime";
import { storage } from "../../storage";

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
    return storage.getAlertConfigurations(equipmentId);
  }

  /**
   * Get single configuration by ID
   */
  async findConfigurationById(id: string): Promise<AlertConfiguration | undefined> {
    const configs = await storage.getAlertConfigurations();
    return configs.find((c) => c.id === id);
  }

  /**
   * Create new alert configuration
   */
  async createConfiguration(config: InsertAlertConfig): Promise<AlertConfiguration> {
    return storage.createAlertConfiguration(config);
  }

  /**
   * Update alert configuration
   */
  async updateConfiguration(
    id: string,
    config: Partial<InsertAlertConfig>
  ): Promise<AlertConfiguration> {
    return storage.updateAlertConfiguration(id, config);
  }

  /**
   * Delete alert configuration
   */
  async deleteConfiguration(id: string): Promise<void> {
    return storage.deleteAlertConfiguration(id);
  }

  // ========== Alert Notifications ==========

  /**
   * Get all alert notifications, optionally filtered by acknowledgment status
   */
  async findAllNotifications(acknowledged?: boolean): Promise<AlertNotification[]> {
    return storage.getAlertNotifications(acknowledged);
  }

  /**
   * Create new alert notification
   */
  async createNotification(notification: InsertAlertNotification): Promise<AlertNotification> {
    return storage.createAlertNotification(notification);
  }

  /**
   * Acknowledge an alert notification
   */
  async acknowledgeNotification(id: string, acknowledgedBy: string): Promise<AlertNotification> {
    return storage.acknowledgeAlert(id, acknowledgedBy);
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
    return storage.hasRecentAlert(equipmentId, sensorType, alertType, minutesBack);
  }

  // ========== Alert Comments ==========

  /**
   * Add comment to alert
   */
  async addComment(commentData: InsertAlertComment): Promise<AlertComment> {
    return storage.addAlertComment(commentData);
  }

  /**
   * Get all comments for an alert
   */
  async getComments(alertId: string): Promise<AlertComment[]> {
    return storage.getAlertComments(alertId);
  }

  // ========== Alert Suppressions ==========

  /**
   * Create alert suppression
   */
  async createSuppression(suppressionData: InsertAlertSuppression): Promise<AlertSuppression> {
    return storage.createAlertSuppression(suppressionData);
  }

  /**
   * Get all active suppressions
   */
  async findAllSuppressions(): Promise<AlertSuppression[]> {
    return storage.getActiveSuppressions();
  }

  /**
   * Remove alert suppression
   */
  async deleteSuppression(id: string): Promise<void> {
    return storage.removeAlertSuppression(id);
  }

  /**
   * Check if alert is currently suppressed
   */
  async isAlertSuppressed(
    equipmentId: string,
    sensorType: string,
    alertType: string
  ): Promise<boolean> {
    return storage.isAlertSuppressed(equipmentId, sensorType, alertType);
  }

  // ========== Utility Methods ==========

  /**
   * Delete all alerts and notifications
   */
  async deleteAllNotifications(): Promise<void> {
    return storage.clearAllAlerts();
  }
}

// Export singleton instance
export const alertsRepository = new AlertsRepository();
