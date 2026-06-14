/**
 * Crew Extensions - Types
 */

export interface AlertScanResult {
  scanned: number;
  flagged: number;
  critical: number;
  warning: number;
  notice: number;
}

export interface NotificationSettingsData {
  emailAlertsEnabled?: boolean;
  certExpiryEmailEnabled?: boolean;
  documentExpiryEmailEnabled?: boolean;
  complianceEmailEnabled?: boolean;
  overrideEmail?: string | null;
}
