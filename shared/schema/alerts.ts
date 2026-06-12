/**
 * Schema Alerts - Alert Configurations and Notifications
 *
 * Alert settings, notifications, suppressions, and cooldowns.
 *
 * NOTE: Reconciled 2026-05-17 to match the real PostgreSQL DB. The previous
 * declarations for alertSettings / alertSettingsVessel / alertNotifications /
 * alertSuppressions were fictional and forced consumers to use escape-hatch casts.
 * The shapes here now reflect what psql reports.
 */

export * from "./alerts/core";
export * from "./alerts/settings";
export * from "./alerts/queues";
