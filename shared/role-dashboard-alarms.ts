/* ------------------------------------------------------------------ *
 * Safety alarms
 * ------------------------------------------------------------------ */

export const ALARM_SEVERITIES = ["info", "warning", "critical", "emergency"] as const;
export type AlarmSeverity = (typeof ALARM_SEVERITIES)[number];

export const ALARM_MODES = ["real", "drill", "test"] as const;
export type AlarmMode = (typeof ALARM_MODES)[number];

export const ALARM_STATUSES = ["active", "cleared"] as const;
export type AlarmStatus = (typeof ALARM_STATUSES)[number];

/** Severities that require an explicit admin confirmation to activate in real mode. */
export const CONFIRM_REQUIRED_SEVERITIES: readonly AlarmSeverity[] = ["critical", "emergency"];

export interface ProtectedAlarmTypeSeed {
  key: string;
  displayName: string;
  defaultSeverity: AlarmSeverity;
  requiresAcknowledgement: boolean;
}

export const PROTECTED_ALARM_TYPES: ProtectedAlarmTypeSeed[] = [
  {
    key: "fire_alarm",
    displayName: "Fire Alarm",
    defaultSeverity: "emergency",
    requiresAcknowledgement: true,
  },
  {
    key: "man_overboard",
    displayName: "Man Overboard",
    defaultSeverity: "emergency",
    requiresAcknowledgement: true,
  },
  {
    key: "abandon_vessel",
    displayName: "Abandon Vessel",
    defaultSeverity: "emergency",
    requiresAcknowledgement: true,
  },
  {
    key: "medical_emergency",
    displayName: "Medical Emergency",
    defaultSeverity: "critical",
    requiresAcknowledgement: true,
  },
  {
    key: "collision_grounding",
    displayName: "Collision / Grounding",
    defaultSeverity: "emergency",
    requiresAcknowledgement: true,
  },
  {
    key: "flooding_water_ingress",
    displayName: "Flooding / Water Ingress",
    defaultSeverity: "emergency",
    requiresAcknowledgement: true,
  },
  {
    key: "engine_room_emergency",
    displayName: "Engine Room Emergency",
    defaultSeverity: "critical",
    requiresAcknowledgement: true,
  },
  {
    key: "security_threat",
    displayName: "Security Threat",
    defaultSeverity: "critical",
    requiresAcknowledgement: true,
  },
  {
    key: "gas_leak",
    displayName: "Gas Leak",
    defaultSeverity: "critical",
    requiresAcknowledgement: true,
  },
  {
    key: "machinery_emergency",
    displayName: "Machinery Emergency",
    defaultSeverity: "critical",
    requiresAcknowledgement: true,
  },
  {
    key: "evacuation",
    displayName: "Evacuation",
    defaultSeverity: "emergency",
    requiresAcknowledgement: true,
  },
  {
    key: "muster_alarm",
    displayName: "Muster Alarm",
    defaultSeverity: "critical",
    requiresAcknowledgement: true,
  },
  {
    key: "general_emergency",
    displayName: "General Emergency",
    defaultSeverity: "emergency",
    requiresAcknowledgement: true,
  },
];

export const PROTECTED_ALARM_TYPE_KEYS = PROTECTED_ALARM_TYPES.map((t) => t.key);

/**
 * Operational safety note shown alongside the alarm UI. This is an in-app
 * notice only — never a replacement for physical alarms or muster procedures.
 */
export const ALARM_SAFETY_NOTE =
  "In-app emergency notice only. This does not replace physical alarms, muster procedures, radio, or SMS/phone escalation.";

/* ------------------------------------------------------------------ *
 * Severity ordering helper (for banner sort)
 * ------------------------------------------------------------------ */

export const ALARM_SEVERITY_RANK: Record<AlarmSeverity, number> = {
  emergency: 3,
  critical: 2,
  warning: 1,
  info: 0,
};
