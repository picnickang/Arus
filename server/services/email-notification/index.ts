/**
 * Email Notification - Index
 *
 * Modularized Email Notification Service
 *
 * Original: 880 lines
 * Modularized into 8 files:
 * - types.ts (~55 lines): Types and configuration
 * - logger.ts (~40 lines): Logging utilities
 * - email-sender.ts (~105 lines): Core email sending
 * - templates.ts (~115 lines): Email templates
 * - queue-processor.ts (~150 lines): Queue processing
 * - crew-notifications.ts (~230 lines): Crew notification handlers
 * - service.ts (~175 lines): Main service class
 */

export { emailNotificationService } from "./service.js";

export type { CrewNotificationCheck, EmailPayload, SendResult, RetryConfig } from "./types.js";

export {
  DEFAULT_RETRY_CONFIG,
  RETRYABLE_STATUS_CODES,
  SEVERITY_LEVELS,
  SEVERITY_COLORS,
} from "./types.js";

export { log, sleep, calculateBackoff } from "./logger.js";

export { emailSender, EmailSender } from "./email-sender.js";

export {
  getSeverityColor,
  getUrgencyInfo,
  buildComplianceSubject,
  buildComplianceBody,
  buildAlertBody,
  buildLogbookReminderBody,
} from "./templates.js";

export {
  queueNotification,
  processQueueItem,
  processDigestQueue,
  retryFailedNotifications,
} from "./queue-processor.js";

export {
  checkCrewNotificationEnabled,
  sendCertificationExpiryNotification,
  sendDocumentExpiryNotification,
  sendCrewComplianceNotification,
} from "./crew-notifications.js";
