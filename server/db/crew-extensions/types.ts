/**
 * Crew Extensions - Types
 */

export type {
  SelectCrewCertification,
  InsertCrewCertification,
  SelectCrewDocument,
  InsertCrewDocument,
  CrewNotificationSettings,
  PortCall as SelectPortCall,
  InsertPortCall,
  DrydockWindow as SelectDrydockWindow,
  InsertDrydockWindow,
} from "@shared/schema";

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
