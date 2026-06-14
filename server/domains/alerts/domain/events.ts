/**
 * Alerts Domain - Events
 *
 * The alerts domain publishes change events through the shared journal/outbox
 * (`recordAndPublish`) keyed by entity type and operation. These aliases name
 * the value space the `IAlertEventPublisher` port speaks in, so the application
 * layer never depends on the concrete `server/sync-events` types directly.
 */

export type AlertEntityType =
  | "alert_configuration"
  | "alert_notification"
  | "alert_suppression"
  | "alert_comment";

export type AlertChangeOperation = "create" | "update" | "delete" | "escalate";
