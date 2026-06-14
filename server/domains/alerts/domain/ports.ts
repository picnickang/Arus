/**
 * Alerts Domain - Ports (Interfaces)
 *
 * Contracts the application layer depends on; concrete adapters live in
 * `infrastructure/`. No port references `server/db/*` or `server/repositories` —
 * that coupling is confined to the adapters.
 */

import type { WidenPartial } from "../../../lib/widen-partial";
import type { WorkOrder, InsertWorkOrder } from "@shared/schema";
import type {
  AlertConfigurationEntity,
  AlertNotificationEntity,
  AlertSuppressionEntity,
  AlertCommentEntity,
  CreateAlertConfigurationCommand,
  CreateAlertNotificationCommand,
  CreateAlertSuppressionCommand,
  CreateAlertCommentCommand,
} from "./types";
import type { AlertEntityType, AlertChangeOperation } from "./events";

/** Port for alerts persistence (configurations, notifications, suppressions, comments). */
export interface IAlertRepository {
  // Configurations
  findAllConfigurations(equipmentId?: string): Promise<AlertConfigurationEntity[]>;
  findConfigurationById(id: string): Promise<AlertConfigurationEntity | undefined>;
  createConfiguration(
    config: CreateAlertConfigurationCommand
  ): Promise<AlertConfigurationEntity>;
  updateConfiguration(
    id: string,
    config: WidenPartial<CreateAlertConfigurationCommand>
  ): Promise<AlertConfigurationEntity>;
  deleteConfiguration(id: string): Promise<void>;

  // Notifications
  findAllNotifications(
    acknowledged?: boolean,
    orgId?: string
  ): Promise<AlertNotificationEntity[]>;
  createNotification(
    notification: CreateAlertNotificationCommand
  ): Promise<AlertNotificationEntity>;
  acknowledgeNotification(id: string, acknowledgedBy: string): Promise<AlertNotificationEntity>;
  hasRecentAlert(
    equipmentId: string,
    sensorType: string,
    alertType: string,
    minutesBack?: number
  ): Promise<boolean>;

  // Comments
  addComment(commentData: CreateAlertCommentCommand): Promise<AlertCommentEntity>;
  getComments(alertId: string): Promise<AlertCommentEntity[]>;

  // Suppressions
  createSuppression(
    suppressionData: CreateAlertSuppressionCommand
  ): Promise<AlertSuppressionEntity>;
  findAllSuppressions(orgId?: string): Promise<AlertSuppressionEntity[]>;
  deleteSuppression(id: string): Promise<void>;
  isAlertSuppressed(
    equipmentId: string,
    sensorType: string,
    alertType: string,
    orgId: string
  ): Promise<boolean>;

  // Utility
  deleteAllNotifications(): Promise<void>;
}

/** Port for recording alert change events to the journal/outbox. */
export interface IAlertEventPublisher {
  record(
    entityType: AlertEntityType,
    entityId: string,
    operation: AlertChangeOperation,
    payload: unknown,
    userId?: string
  ): Promise<void>;
}

/** Port for real-time alert fan-out (MQTT) and acknowledgement metrics. */
export interface IAlertRealtimeNotifier {
  publishAlertCreated(alert: AlertNotificationEntity): void;
  recordAcknowledged(equipmentId: string): void;
}

/** Port for escalating an alert into a work order. */
export interface IWorkOrderEscalator {
  createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder>;
}
