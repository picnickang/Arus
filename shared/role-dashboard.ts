/**
 * Shared types & validation for the role-aware configurable User page.
 *
 * Defines the vocabulary that drives what each role sees on the User page:
 * dashboard widgets, personal task-feed sources, visibility scope, quick
 * actions, and the high-impact operational question each widget answers.
 *
 * `RoleName` and `AlarmTypeKey` stay open strings (orgs can define their own)
 * but the protected built-in keys are exposed as constants and the config
 * shape is validated at runtime with the zod schemas below.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Dashboard widgets
 * ------------------------------------------------------------------ */

export const DASHBOARD_WIDGETS = [
  "current_vessel",
  "shift_status",
  "safety_status",
  "user_tasks",
  "active_alerts",
  "safety_notices",
  "upcoming_maintenance",
] as const;

export type WidgetKey = (typeof DASHBOARD_WIDGETS)[number];

export const WIDGET_LABELS: Record<WidgetKey, string> = {
  current_vessel: "Current Vessel",
  shift_status: "Shift Status",
  safety_status: "Safety Status",
  user_tasks: "My Tasks",
  active_alerts: "Active Alerts",
  safety_notices: "Safety Notices",
  upcoming_maintenance: "Upcoming Maintenance",
};

/**
 * Every widget must answer a high-impact operational question. These are the
 * default question labels; a role config may override them per widget.
 */
export const WIDGET_HIGH_IMPACT_QUESTIONS: Record<WidgetKey, string> = {
  current_vessel: "Which vessel am I responsible for right now?",
  shift_status: "Am I on shift, and who has the watch?",
  safety_status: "Is it safe to operate right now?",
  user_tasks: "What do I need to act on first?",
  active_alerts: "What is going wrong that needs attention now?",
  safety_notices: "What safety information must I be aware of?",
  upcoming_maintenance: "What maintenance is due soon on my vessel?",
};

/* ------------------------------------------------------------------ *
 * Personal task-feed sources
 * ------------------------------------------------------------------ */

export const TASK_SOURCES = [
  "work_orders",
  "maintenance_schedules",
  "alerts",
  "insights",
  "purchase_requests",
  "service_requests",
  "reservations",
] as const;

export type TaskSourceKey = (typeof TASK_SOURCES)[number];

export const TASK_SOURCE_LABELS: Record<TaskSourceKey, string> = {
  work_orders: "Work Orders",
  maintenance_schedules: "Maintenance",
  alerts: "Alerts",
  insights: "Insights",
  purchase_requests: "Purchase Requests",
  service_requests: "Service Requests",
  reservations: "Reservations",
};

/* ------------------------------------------------------------------ *
 * Visibility scope
 * ------------------------------------------------------------------ */

export const VISIBILITY_SCOPES = ["self", "vessel", "department", "fleet"] as const;
export type VisibilityScope = (typeof VISIBILITY_SCOPES)[number];

/** Lower index = more restrictive. Used by the multi-role merge rules. */
export const VISIBILITY_SCOPE_RANK: Record<VisibilityScope, number> = {
  self: 0,
  vessel: 1,
  department: 2,
  fleet: 3,
};

/* ------------------------------------------------------------------ *
 * Role dashboard config shape
 * ------------------------------------------------------------------ */

export const roleDashboardConfigSchema = z.object({
  widgets: z.array(z.enum(DASHBOARD_WIDGETS)).default([]),
  taskSources: z.array(z.enum(TASK_SOURCES)).default([]),
  visibilityScope: z.enum(VISIBILITY_SCOPES).default("vessel"),
  quickActions: z.array(z.string()).default([]),
  filters: z.record(z.unknown()).default({}),
  highImpactQuestions: z.record(z.string()).default({}),
});

export type RoleDashboardConfig = z.infer<typeof roleDashboardConfigSchema>;

export function emptyDashboardConfig(): RoleDashboardConfig {
  return {
    widgets: [],
    taskSources: [],
    visibilityScope: "vessel",
    quickActions: [],
    filters: {},
    highImpactQuestions: {},
  };
}

/**
 * Safe minimal dashboard used as a fallback when a role config cannot be
 * loaded — read-only, vessel-scoped, no admin data.
 */
export function safeMinimalDashboardConfig(): RoleDashboardConfig {
  return {
    widgets: ["current_vessel", "safety_status", "safety_notices", "active_alerts"],
    taskSources: [],
    visibilityScope: "self",
    quickActions: [],
    filters: {},
    highImpactQuestions: {},
  };
}

/* ------------------------------------------------------------------ *
 * Protected built-in roles + their default dashboard configs
 * ------------------------------------------------------------------ */

export const PROTECTED_ROLE_KEYS = [
  "admin",
  "chief_engineer",
  "technician",
  "vessel_master",
  "crew_member",
  "logistics_user",
  "procurement_user",
  "safety_officer",
  "maintenance_planner",
] as const;

export type ProtectedRoleKey = (typeof PROTECTED_ROLE_KEYS)[number];

/** Roles that carry admin-capability for lockout-protection purposes. */
export const ADMIN_CAPABLE_ROLE_KEYS = [
  "admin",
  "system_admin",
  "company_admin",
] as const;

export const DEFAULT_ROLE_DASHBOARD_CONFIGS: Record<string, RoleDashboardConfig> = {
  admin: {
    widgets: [...DASHBOARD_WIDGETS],
    taskSources: [...TASK_SOURCES],
    visibilityScope: "fleet",
    quickActions: ["create_work_order", "view_analytics"],
    filters: {},
    highImpactQuestions: {},
  },
  chief_engineer: {
    widgets: [
      "current_vessel",
      "shift_status",
      "safety_status",
      "user_tasks",
      "active_alerts",
      "upcoming_maintenance",
    ],
    taskSources: ["work_orders", "maintenance_schedules", "alerts", "purchase_requests"],
    visibilityScope: "vessel",
    quickActions: ["create_work_order"],
    filters: {},
    highImpactQuestions: {},
  },
  technician: {
    widgets: ["current_vessel", "shift_status", "user_tasks", "upcoming_maintenance", "active_alerts"],
    taskSources: ["work_orders", "maintenance_schedules"],
    visibilityScope: "self",
    quickActions: ["complete_work_order"],
    filters: {},
    highImpactQuestions: {},
  },
  vessel_master: {
    widgets: [...DASHBOARD_WIDGETS],
    taskSources: ["work_orders", "maintenance_schedules", "alerts", "service_requests"],
    visibilityScope: "vessel",
    quickActions: [],
    filters: {},
    highImpactQuestions: {},
  },
  crew_member: {
    widgets: ["current_vessel", "shift_status", "safety_status", "user_tasks", "safety_notices"],
    taskSources: ["work_orders"],
    visibilityScope: "self",
    quickActions: [],
    filters: {},
    highImpactQuestions: {},
  },
  logistics_user: {
    widgets: ["current_vessel", "user_tasks", "upcoming_maintenance"],
    taskSources: ["purchase_requests", "service_requests", "reservations"],
    visibilityScope: "department",
    quickActions: [],
    filters: {},
    highImpactQuestions: {},
  },
  procurement_user: {
    widgets: ["current_vessel", "user_tasks"],
    taskSources: ["purchase_requests"],
    visibilityScope: "fleet",
    quickActions: [],
    filters: {},
    highImpactQuestions: {},
  },
  safety_officer: {
    widgets: ["current_vessel", "safety_status", "safety_notices", "active_alerts", "user_tasks"],
    taskSources: ["alerts", "insights"],
    visibilityScope: "fleet",
    quickActions: [],
    filters: {},
    highImpactQuestions: {},
  },
  maintenance_planner: {
    widgets: ["current_vessel", "user_tasks", "upcoming_maintenance", "active_alerts"],
    taskSources: ["work_orders", "maintenance_schedules", "insights"],
    visibilityScope: "fleet",
    quickActions: ["create_work_order"],
    filters: {},
    highImpactQuestions: {},
  },
};

export function defaultConfigForRole(roleName: string): RoleDashboardConfig {
  return DEFAULT_ROLE_DASHBOARD_CONFIGS[roleName] ?? safeMinimalDashboardConfig();
}

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
  { key: "fire_alarm", displayName: "Fire Alarm", defaultSeverity: "emergency", requiresAcknowledgement: true },
  { key: "man_overboard", displayName: "Man Overboard", defaultSeverity: "emergency", requiresAcknowledgement: true },
  { key: "abandon_vessel", displayName: "Abandon Vessel", defaultSeverity: "emergency", requiresAcknowledgement: true },
  { key: "medical_emergency", displayName: "Medical Emergency", defaultSeverity: "critical", requiresAcknowledgement: true },
  { key: "collision_grounding", displayName: "Collision / Grounding", defaultSeverity: "emergency", requiresAcknowledgement: true },
  { key: "flooding_water_ingress", displayName: "Flooding / Water Ingress", defaultSeverity: "emergency", requiresAcknowledgement: true },
  { key: "engine_room_emergency", displayName: "Engine Room Emergency", defaultSeverity: "critical", requiresAcknowledgement: true },
  { key: "security_threat", displayName: "Security Threat", defaultSeverity: "critical", requiresAcknowledgement: true },
  { key: "gas_leak", displayName: "Gas Leak", defaultSeverity: "critical", requiresAcknowledgement: true },
  { key: "machinery_emergency", displayName: "Machinery Emergency", defaultSeverity: "critical", requiresAcknowledgement: true },
  { key: "evacuation", displayName: "Evacuation", defaultSeverity: "emergency", requiresAcknowledgement: true },
  { key: "muster_alarm", displayName: "Muster Alarm", defaultSeverity: "critical", requiresAcknowledgement: true },
  { key: "general_emergency", displayName: "General Emergency", defaultSeverity: "emergency", requiresAcknowledgement: true },
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
