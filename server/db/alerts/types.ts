/**
 * Alerts - Types
 *
 * Schema-runtime re-exports tables as constants but not their inferred
 * Insert/Select types, so we derive them locally via $inferSelect/$inferInsert.
 */

import type {
  alertConfigurations,
  alertNotifications,
  alertSuppressions,
  alertComments,
} from "@shared/schema-runtime";

export type AlertConfiguration = typeof alertConfigurations.$inferSelect;
export type InsertAlertConfig = typeof alertConfigurations.$inferInsert;
export type AlertNotification = typeof alertNotifications.$inferSelect;
export type InsertAlertNotification = typeof alertNotifications.$inferInsert;
export type AlertSuppression = typeof alertSuppressions.$inferSelect;
export type InsertAlertSuppression = typeof alertSuppressions.$inferInsert;
export type AlertComment = typeof alertComments.$inferSelect;
export type InsertAlertComment = typeof alertComments.$inferInsert;
