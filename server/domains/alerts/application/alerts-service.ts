/**
 * Alerts Application Service
 *
 * Use-case orchestration for the alerts domain. Business logic, event
 * publishing, and realtime fan-out are coordinated here through injected ports;
 * the service holds no direct database or repositories coupling.
 */

import type { WidenPartial } from "../../../lib/widen-partial";
import type { WorkOrder, InsertWorkOrder } from "@shared/schema";
import type {
  IAlertRepository,
  IAlertEventPublisher,
  IAlertRealtimeNotifier,
  IWorkOrderEscalator,
} from "../domain/ports";
import type {
  AlertConfigurationEntity,
  AlertNotificationEntity,
  AlertSuppressionEntity,
  AlertCommentEntity,
  AlertsWsBroadcaster,
  AlertEscalationCommand,
  CreateAlertConfigurationCommand,
  CreateAlertNotificationCommand,
  CreateAlertSuppressionCommand,
  CreateAlertCommentCommand,
} from "../domain/types";

export class AlertsApplicationService {
  constructor(
    private readonly repository: IAlertRepository,
    private readonly events: IAlertEventPublisher,
    private readonly realtime: IAlertRealtimeNotifier,
    private readonly escalator: IWorkOrderEscalator
  ) {}

  // ========== Alert Configurations ==========

  async listConfigurations(equipmentId?: string): Promise<AlertConfigurationEntity[]> {
    return this.repository.findAllConfigurations(equipmentId);
  }

  async getConfigurationById(id: string): Promise<AlertConfigurationEntity | undefined> {
    return this.repository.findConfigurationById(id);
  }

  async createConfiguration(
    config: CreateAlertConfigurationCommand,
    userId?: string
  ): Promise<AlertConfigurationEntity> {
    const configuration = await this.repository.createConfiguration(config);
    await this.events.record("alert_configuration", configuration.id, "create", configuration, userId);
    return configuration;
  }

  async updateConfiguration(
    id: string,
    config: WidenPartial<CreateAlertConfigurationCommand>,
    userId?: string
  ): Promise<AlertConfigurationEntity> {
    const configuration = await this.repository.updateConfiguration(id, config);
    await this.events.record("alert_configuration", configuration.id, "update", configuration, userId);
    return configuration;
  }

  async deleteConfiguration(id: string, userId?: string): Promise<void> {
    const configuration = await this.repository.findConfigurationById(id);
    await this.repository.deleteConfiguration(id);
    if (configuration) {
      await this.events.record("alert_configuration", id, "delete", configuration, userId);
    }
  }

  // ========== Alert Notifications ==========

  async listNotifications(
    acknowledged?: boolean,
    orgId?: string
  ): Promise<AlertNotificationEntity[]> {
    return this.repository.findAllNotifications(acknowledged, orgId);
  }

  async createNotification(
    notification: CreateAlertNotificationCommand,
    userId?: string,
    wsServerInstance?: AlertsWsBroadcaster
  ): Promise<AlertNotificationEntity> {
    const alertNotification = await this.repository.createNotification(notification);

    // Reliable MQTT fan-out (fire and forget).
    this.realtime.publishAlertCreated(alertNotification);

    // Instant UI update via WebSocket.
    if (wsServerInstance) {
      wsServerInstance.broadcastAlert(alertNotification);
    }

    await this.events.record(
      "alert_notification",
      alertNotification.id,
      "create",
      alertNotification,
      userId
    );

    return alertNotification;
  }

  async acknowledgeNotification(
    id: string,
    acknowledgedBy: string,
    userId?: string,
    wsServerInstance?: AlertsWsBroadcaster
  ): Promise<AlertNotificationEntity> {
    const notification = await this.repository.acknowledgeNotification(id, acknowledgedBy);

    if (notification) {
      this.realtime.recordAcknowledged(notification.equipmentId || "unknown");
    }

    if (wsServerInstance) {
      wsServerInstance.broadcastAlertAcknowledged(id, acknowledgedBy);
    }

    await this.events.record("alert_notification", id, "update", notification, userId);

    return notification;
  }

  // ========== Alert Comments ==========

  async addComment(
    commentData: CreateAlertCommentCommand,
    userId?: string
  ): Promise<AlertCommentEntity> {
    const comment = await this.repository.addComment(commentData);
    await this.events.record("alert_comment", comment.id, "create", comment, userId);
    return comment;
  }

  async getComments(alertId: string): Promise<AlertCommentEntity[]> {
    return this.repository.getComments(alertId);
  }

  // ========== Alert Suppressions ==========

  async createSuppression(
    suppressionData: CreateAlertSuppressionCommand,
    userId?: string,
    wsServerInstance?: AlertsWsBroadcaster
  ): Promise<AlertSuppressionEntity> {
    const suppression = await this.repository.createSuppression(suppressionData);

    if (wsServerInstance) {
      wsServerInstance.broadcastAlertSuppression(suppression);
    }

    await this.events.record("alert_suppression", suppression.id, "create", suppression, userId);

    return suppression;
  }

  async listSuppressions(orgId?: string): Promise<AlertSuppressionEntity[]> {
    return this.repository.findAllSuppressions(orgId);
  }

  async deleteSuppression(id: string, userId?: string): Promise<void> {
    const suppressions = await this.repository.findAllSuppressions();
    const suppression = suppressions.find((s) => s.id === id);

    await this.repository.deleteSuppression(id);

    if (suppression) {
      await this.events.record("alert_suppression", id, "delete", suppression, userId);
    }
  }

  // ========== Special Operations ==========

  /**
   * Escalate an alert to a work order. The work-order creation is delegated to
   * the injected escalator port; the optional callback lets the interfaces layer
   * broadcast the new work order over its WebSocket transport.
   */
  async escalateNotification(
    alertId: string,
    escalationData: AlertEscalationCommand,
    userId?: string,
    onWorkOrderCreated?: (workOrder: WorkOrder) => void
  ): Promise<WorkOrder> {
    const notifications = await this.repository.findAllNotifications();
    const alert = notifications.find((n) => n.id === alertId);

    if (!alert) {
      throw new Error("Alert not found");
    }

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

    const workOrder = await this.escalator.createWorkOrder(workOrderData);

    if (onWorkOrderCreated) {
      onWorkOrderCreated(workOrder);
    }

    await this.events.record(
      "alert_notification",
      alertId,
      "escalate",
      { alertId, workOrderId: workOrder.id, escalationData },
      userId
    );

    return workOrder;
  }

  async deleteAllNotifications(
    userId?: string,
    wsServerInstance?: AlertsWsBroadcaster
  ): Promise<void> {
    await this.repository.deleteAllNotifications();

    if (wsServerInstance) {
      wsServerInstance.broadcastToAll({
        type: "alerts-cleared",
        message: "All alerts have been cleared",
      });
    }

    await this.events.record(
      "alert_notification",
      "all",
      "delete",
      { action: "clear_all" },
      userId
    );
  }
}
