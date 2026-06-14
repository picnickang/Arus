/**
 * Notifications Domain - Types
 *
 * Entity/command types alias the canonical schema types (`@shared/schema`); the
 * storage layer already returns these shapes, so aliasing keeps the conversion
 * behaviour-identical (see the alerts reference and the remediation plan §3).
 */

import type {
  OrgNotificationSettings,
  InsertOrgNotificationSettings,
  NotificationQueue,
  InsertNotificationQueue,
} from "@shared/schema";

export type NotificationSettingsEntity = OrgNotificationSettings;
export type NotificationQueueEntity = NotificationQueue;

export type CreateNotificationSettingsCommand = InsertOrgNotificationSettings;
export type UpdateNotificationSettingsCommand = Partial<InsertOrgNotificationSettings>;
export type CreateNotificationQueueCommand = InsertNotificationQueue;
