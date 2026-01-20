export interface AlertConfiguration {
  id: string;
  orgId: string;
  equipmentId?: string;
  vesselId?: string;
  alertType: string;
  sensorType?: string;
  threshold?: number;
  thresholdUnit?: string;
  operator?: "gt" | "lt" | "eq" | "gte" | "lte";
  severity: "info" | "warning" | "critical";
  isEnabled: boolean;
  cooldownMinutes?: number;
  notifyEmail?: boolean;
  notifySms?: boolean;
  notifyPush?: boolean;
  recipients?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AlertNotification {
  id: string;
  orgId: string;
  configurationId?: string;
  equipmentId?: string;
  vesselId?: string;
  alertType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  value?: number;
  threshold?: number;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  acknowledgedNotes?: string;
  createdAt: Date;
}

export interface AlertThreshold {
  key: string;
  sensorType: string;
  equipmentType?: string;
  warningMin?: number;
  warningMax?: number;
  criticalMin?: number;
  criticalMax?: number;
  unit?: string;
  description?: string;
}

export interface EmailAlertSettings {
  id: string;
  orgId: string;
  emailEnabled: boolean;
  defaultToEmail: string | null;
  ccEmails: string[] | null;
  bccEmails: string[] | null;
  timezone: string;
  provider: "sendgrid" | "smtp" | "aws_ses";
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpUseTls: boolean;
  fromEmail: string;
  fromName: string;
  alertCooldownMinutes: number;
  dailyDigestEnabled: boolean;
  dailyDigestTime: string;
  lastTestStatus: string | null;
  lastTestAt: string | null;
  lastTestError: string | null;
  hasApiKey: boolean;
  hasSmtpPassword: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EmailAlertThreshold {
  id: string;
  key: string;
  orgId: string;
  category: string;
  severity: string;
  enabled: boolean;
  thresholdValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  thresholdUnit: string | null;
  name: string;
  description: string | null;
  sendEmail: boolean;
  cooldownMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  orgId: string;
  alertType: string;
  recipientEmail: string;
  subject: string;
  status: "pending" | "sent" | "failed" | "bounced";
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface CrewAlertSettings {
  [crewMemberId: string]: {
    certificateExpiry: boolean;
    hoursOfRestViolation: boolean;
    missingSignature: boolean;
    minimumManning: boolean;
    crewChange: boolean;
    customEmail: string | null;
  };
}

export interface ThresholdFormData {
  key: string;
  name: string;
  category: string;
  severity: string;
  thresholdValue: number | null;
  thresholdUnit: string | null;
  enabled: boolean;
  sendEmail: boolean;
  description: string | null;
  cooldownMinutes: number | null;
}

export const ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export const ALERT_OPERATORS = ["gt", "lt", "eq", "gte", "lte"] as const;

export type AlertSeverity = typeof ALERT_SEVERITIES[number];
export type AlertOperator = typeof ALERT_OPERATORS[number];
