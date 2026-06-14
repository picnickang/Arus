/**
 * Alerts Domain - Types
 *
 * Entity and command types for the alerts domain. As a deliberate first step
 * for this reference conversion, the entity types alias the canonical schema
 * types (`@shared/schema`) rather than introducing a separate hand-mapped
 * domain model: the storage layer already returns these shapes, so aliasing
 * keeps the conversion behaviour-identical and avoids an error-prone mapping
 * layer. Introducing a richer anti-corruption model is a recommended follow-up
 * (see docs/architecture/hexagonal-remediation-plan.md §3).
 */

import type {
  AlertConfiguration,
  InsertAlertConfiguration,
  AlertNotification,
  InsertAlertNotification,
  AlertSuppression,
  InsertAlertSuppression,
  AlertComment,
  InsertAlertComment,
} from "@shared/schema";

export type AlertConfigurationEntity = AlertConfiguration;
export type AlertNotificationEntity = AlertNotification;
export type AlertSuppressionEntity = AlertSuppression;
export type AlertCommentEntity = AlertComment;

export type CreateAlertConfigurationCommand = InsertAlertConfiguration;
export type CreateAlertNotificationCommand = InsertAlertNotification;
export type CreateAlertSuppressionCommand = InsertAlertSuppression;
export type CreateAlertCommentCommand = InsertAlertComment;

/**
 * Minimal contract the alerts service needs from the WebSocket server.
 * Kept structural so the existing concrete implementation in
 * `server/websocket-*` continues to satisfy it without modification. This is a
 * UI transport detail supplied per request by the interfaces layer, not a
 * persisted dependency.
 */
export interface AlertsWsBroadcaster {
  broadcastAlert: (alert: AlertNotificationEntity) => void;
  broadcastAlertAcknowledged: (id: string, acknowledgedBy: string) => void;
  broadcastAlertSuppression: (suppression: AlertSuppressionEntity) => void;
  broadcastToAll: (message: { type: string; [key: string]: unknown }) => void;
}

/** Escalation request payload accepted by the application service. */
export interface AlertEscalationCommand {
  reason?: string;
  priority?: number;
  description?: string;
}
