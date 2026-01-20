import {
  Award,
  Clock,
  FileText,
  Users,
  User,
  AlertTriangle,
  Settings2,
  Shield,
} from "lucide-react";

export const ALERT_CATEGORIES = [
  { value: "machinery", label: "Machinery" },
  { value: "telemetry", label: "Telemetry" },
  { value: "compliance", label: "Compliance" },
  { value: "crew", label: "Crew" },
  { value: "logbook", label: "Logbook" },
  { value: "maintenance", label: "Maintenance" },
] as const;

export const ALERT_PRESETS = [
  { key: "CERT_EXPIRY_30", name: "Certificate Expiry (30 days)", category: "crew", thresholdUnit: "days", thresholdValue: 30, icon: Award },
  { key: "CERT_EXPIRY_7", name: "Certificate Expiry (7 days)", category: "crew", thresholdUnit: "days", thresholdValue: 7, icon: Award },
  { key: "HOR_VIOLATION", name: "Hours of Rest Violation", category: "crew", thresholdUnit: "hours", thresholdValue: 10, icon: Clock },
  { key: "MISSING_SIGNATURE", name: "Missing Signature", category: "logbook", thresholdUnit: null, thresholdValue: null, icon: FileText },
  { key: "MIN_MANNING", name: "Minimum Manning Alert", category: "crew", thresholdUnit: null, thresholdValue: null, icon: Users },
  { key: "CREW_CHANGE", name: "Crew Change Reminder", category: "crew", thresholdUnit: "days", thresholdValue: 14, icon: User },
  { key: "EQUIPMENT_CRITICAL", name: "Equipment Critical Alert", category: "machinery", thresholdUnit: null, thresholdValue: null, icon: AlertTriangle },
  { key: "MAINTENANCE_DUE", name: "Maintenance Due", category: "maintenance", thresholdUnit: "days", thresholdValue: 7, icon: Settings2 },
  { key: "COMPLIANCE_ALERT", name: "Compliance Alert", category: "compliance", thresholdUnit: null, thresholdValue: null, icon: Shield },
] as const;

export const EMAIL_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  sent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  bounced: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

export const TIMEZONES = [
  { value: "Asia/Singapore", label: "Singapore (SGT, UTC+8)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
] as const;

export const DEFAULT_EMAIL_SETTINGS = {
  emailEnabled: false,
  defaultToEmail: null as string | null,
  ccEmails: null as string[] | null,
  bccEmails: null as string[] | null,
  provider: "sendgrid" as const,
  smtpHost: null as string | null,
  smtpUser: null as string | null,
  fromEmail: "noreply@arus-marine.com",
  fromName: "ARUS Marine",
  timezone: "Asia/Singapore",
  smtpPort: 587,
  smtpUseTls: true,
  alertCooldownMinutes: 30,
  dailyDigestEnabled: false,
  dailyDigestTime: "08:00",
};

export const DEFAULT_THRESHOLD_FORM = {
  key: "CERT_EXPIRY_30",
  name: "Certificate Expiry (30 days)",
  category: "crew",
  severity: "warning",
  thresholdValue: 30 as number | null,
  thresholdUnit: "days" as string | null,
  enabled: true,
  sendEmail: true,
  description: "" as string | null,
  cooldownMinutes: null as number | null,
};
