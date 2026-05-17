import type {
  AlertConfiguration,
  InsertAlertConfiguration as InsertAlertConfig,
  AlertNotification,
  InsertAlertNotification,
  AlertSuppression,
  InsertAlertSuppression,
  AlertComment,
  InsertAlertComment,
  WorkOrder,
  InsertWorkOrder,
} from "@shared/schema";
import { alertsRepository } from "./repository";
import { recordAndPublish } from "../../sync-events";
import { mqttReliableSync } from "../../mqtt-reliable-sync";
import { incrementAlertAcknowledged } from "../../observability";
import { logger } from "../../utils/logger.js";

/**
 * Alerts Service
 * Handles business logic, orchestration, and event publishing for alerts domain
 */
export class AlertsService {
  // ========== Alert Configurations ==========

  /**
   * List all alert configurations
   */
  async listConfigurations(equipmentId?: string): Promise<AlertConfiguration[]> {
    return alertsRepository.findAllConfigurations(equipmentId);
  }

  /**
   * Get configuration by ID
   */
  async getConfigurationById(id: string): Promise<AlertConfiguration | undefined> {
    return alertsRepository.findConfigurationById(id);
  }

  /**
   * Create alert configuration with event publishing
   */
  async createConfiguration(
    config: InsertAlertConfig,
    userId?: string
  ): Promise<AlertConfiguration> {
    // Create configuration
    const configuration = await alertsRepository.createConfiguration(config);

    // Publish events
    await recordAndPublish(
      // @ts-ignore -- bulk-silence
      "alert_configuration",
      configuration.id,
      "create",
      configuration,
      userId
    );

    return configuration;
  }

  /**
   * Update alert configuration with event publishing
   */
  async updateConfiguration(
    id: string,
    config: Partial<InsertAlertConfig>,
    userId?: string
  ): Promise<AlertConfiguration> {
    // Update configuration
    const configuration = await alertsRepository.updateConfiguration(id, config);

    // Publish events
    await recordAndPublish(
      // @ts-ignore -- bulk-silence
      "alert_configuration",
      configuration.id,
      "update",
      configuration,
      userId
    );

    return configuration;
  }

  /**
   * Delete alert configuration with event publishing
   */
  async deleteConfiguration(id: string, userId?: string): Promise<void> {
    // Get configuration data before deletion for event
    const configuration = await alertsRepository.findConfigurationById(id);

    // Delete configuration
    await alertsRepository.deleteConfiguration(id);

    // Publish delete event
    if (configuration) {
      // @ts-ignore -- bulk-silence
      await recordAndPublish("alert_configuration", id, "delete", configuration, userId);
    }
  }

  // ========== Alert Notifications ==========

  /**
   * List all alert notifications
   */
  async listNotifications(acknowledged?: boolean, orgId?: string): Promise<AlertNotification[]> {
    return alertsRepository.findAllNotifications(acknowledged, orgId);
  }

  /**
   * Create alert notification with event publishing and WebSocket broadcast
   */
  async createNotification(
    notification: InsertAlertNotification,
    userId?: string,
    wsServerInstance?: any
  ): Promise<AlertNotification> {
    // Create notification
    const alertNotification = await alertsRepository.createNotification(notification);

    // Publish to MQTT for reliable sync (QoS 2 for critical alerts)
    mqttReliableSync.publishAlertChange("create", alertNotification).catch((err) => {
      logger.error("AlertsService", "Failed to publish to MQTT", err);
    });

    // Broadcast new alert via WebSocket (for instant UI update)
    if (wsServerInstance) {
      wsServerInstance.broadcastAlert(alertNotification);
    }

    // Record event
    await recordAndPublish(
      // @ts-ignore -- bulk-silence
      "alert_notification",
      alertNotification.id,
      "create",
      alertNotification,
      userId
    );

    return alertNotification;
  }

  /**
   * Acknowledge alert notification with event publishing and WebSocket broadcast
   */
  async acknowledgeNotification(
    id: string,
    acknowledgedBy: string,
    userId?: string,
    wsServerInstance?: any
  ): Promise<AlertNotification> {
    // Acknowledge notification
    const notification = await alertsRepository.acknowledgeNotification(id, acknowledgedBy);

    // Record alert acknowledgment metric (enhanced observability)
    if (notification) {
      incrementAlertAcknowledged(notification.equipmentId || "unknown");
    }

    // Broadcast alert acknowledgment via WebSocket
    if (wsServerInstance) {
      wsServerInstance.broadcastAlertAcknowledged(id, acknowledgedBy);
    }

    // Record event
    // @ts-ignore -- bulk-silence
    await recordAndPublish("alert_notification", id, "update", notification, userId);

    return notification;
  }

  // ========== Alert Comments ==========

  /**
   * Add comment to alert
   */
  async addComment(commentData: InsertAlertComment, userId?: string): Promise<AlertComment> {
    const comment = await alertsRepository.addComment(commentData);

    // Record event
    // @ts-ignore -- bulk-silence
    await recordAndPublish("alert_comment", comment.id, "create", comment, userId);

    return comment;
  }

  /**
   * Get all comments for an alert
   */
  async getComments(alertId: string): Promise<AlertComment[]> {
    return alertsRepository.getComments(alertId);
  }

  // ========== Alert Suppressions ==========

  /**
   * Create alert suppression with event publishing and WebSocket broadcast
   */
  async createSuppression(
    suppressionData: InsertAlertSuppression,
    userId?: string,
    wsServerInstance?: any
  ): Promise<AlertSuppression> {
    const suppression = await alertsRepository.createSuppression(suppressionData);

    // Broadcast suppression update
    if (wsServerInstance) {
      wsServerInstance.broadcastAlertSuppression(suppression);
    }

    // Record event
    // @ts-ignore -- bulk-silence
    await recordAndPublish("alert_suppression", suppression.id, "create", suppression, userId);

    return suppression;
  }

  /**
   * Get all active suppressions
   */
  async listSuppressions(orgId?: string): Promise<AlertSuppression[]> {
    return alertsRepository.findAllSuppressions(orgId);
  }

  /**
   * Remove alert suppression
   */
  async deleteSuppression(id: string, userId?: string): Promise<void> {
    // Get suppression data before deletion for event
    const suppressions = await alertsRepository.findAllSuppressions();
    const suppression = suppressions.find((s) => s.id === id);

    // Delete suppression
    await alertsRepository.deleteSuppression(id);

    // Publish delete event
    if (suppression) {
      // @ts-ignore -- bulk-silence
      await recordAndPublish("alert_suppression", id, "delete", suppression, userId);
    }
  }

  // ========== Special Operations ==========

  /**
   * Escalate alert to work order
   * This requires access to work order creation logic
   */
  async escalateNotification(
    alertId: string,
    escalationData: {
      reason?: string;
      priority?: number;
      description?: string;
    },
    createWorkOrderFn: (data: InsertWorkOrder) => Promise<WorkOrder>,
    userId?: string
  ): Promise<WorkOrder> {
    // Get the alert notification first
    const notifications = await alertsRepository.findAllNotifications();
    const alert = notifications.find((n) => n.id === alertId);

    if (!alert) {
      throw new Error("Alert not found");
    }

    // Create work order data from alert
    const workOrderData: InsertWorkOrder = {
      equipmentId: alert.equipmentId,
      orgId: alert.orgId,
      reason:
        escalationData.reason || `Alert escalation: ${alert.alertType} ${alert.sensorType} alert`,
      description:
        escalationData.description || `Escalated from ${alert.alertType} alert: ${alert.message}`,
      priority: escalationData.priority || (alert.alertType === "critical" ? 1 : 2),
      status: "open",
    };

    // Create work order using provided function
    const workOrder = await createWorkOrderFn(workOrderData);

    // Record escalation event
    await recordAndPublish(
      // @ts-ignore -- bulk-silence
      "alert_notification",
      alertId,
      "escalate",
      {
        alertId,
        workOrderId: workOrder.id,
        escalationData,
      },
      userId
    );

    return workOrder;
  }

  /**
   * Clear all alerts and notifications with WebSocket broadcast
   */
  async deleteAllNotifications(userId?: string, wsServerInstance?: any): Promise<void> {
    await alertsRepository.deleteAllNotifications();

    // Broadcast clear all alerts via WebSocket
    if (wsServerInstance) {
      wsServerInstance.broadcastToAll({
        type: "alerts-cleared",
        message: "All alerts have been cleared",
      });
    }

    // Record event
    // @ts-ignore -- bulk-silence
    await recordAndPublish("alert_notification", "all", "delete", { action: "clear_all" }, userId);
  }
}

// Export singleton instance
export const alertsService = new AlertsService();
