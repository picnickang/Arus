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
import { jsonRecordSchema } from "./validation/json";
import type { JsonValue } from "./validation/json";
import { createDefaultRoleDashboardConfigs } from "./role-dashboard-defaults";

export * from "./role-dashboard-alarms";
export * from "./role-dashboard-access";

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
const WIDGET_KEY_SET: ReadonlySet<string> = new Set(DASHBOARD_WIDGETS);

export function isWidgetKey(value: string): value is WidgetKey {
  return WIDGET_KEY_SET.has(value);
}

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
 * Widget domain tags (job / department families)
 *
 * Each widget belongs to a job/department domain so the dashboard layout
 * editor can offer only the widgets relevant to a person's job. New
 * domain-specific widgets are added later; today we simply tag the existing
 * set. A domain with no widgets yet (e.g. "logistics") drives the empty-state
 * guidance in the layout editor.
 * ------------------------------------------------------------------ */

export const WIDGET_DOMAINS = ["fleet", "crewing", "maintenance", "logistics", "safety"] as const;
export type WidgetDomain = (typeof WIDGET_DOMAINS)[number];

export const WIDGET_DOMAIN_LABELS: Record<WidgetDomain, string> = {
  fleet: "Fleet",
  crewing: "Crewing",
  maintenance: "Maintenance",
  logistics: "Logistics",
  safety: "Safety",
};

export const WIDGET_DOMAIN_TAGS: Record<WidgetKey, WidgetDomain> = {
  current_vessel: "fleet",
  shift_status: "crewing",
  safety_status: "safety",
  user_tasks: "crewing",
  active_alerts: "maintenance",
  safety_notices: "safety",
  upcoming_maintenance: "maintenance",
};

/** Widgets tagged with any of the given domains, in canonical order. */
export function widgetsForDomains(domains: readonly WidgetDomain[]): WidgetKey[] {
  const wanted = new Set(domains);
  return DASHBOARD_WIDGETS.filter((w) => wanted.has(WIDGET_DOMAIN_TAGS[w]));
}

/* ------------------------------------------------------------------ *
 * Personal task-feed sources
 * ------------------------------------------------------------------ */

export const TASK_SOURCES = [
  "work_orders",
  "maintenance_schedules",
  "alerts",
  "crew_tasks",
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
  crew_tasks: "Crew Tasks",
  insights: "Insights",
  purchase_requests: "Purchase Requests",
  service_requests: "Service Requests",
  reservations: "Reservations",
};

/**
 * The subset of TASK_SOURCES that the personal task feed (`/api/me/tasks`)
 * actually materializes today. The configurable set MUST equal the implemented
 * set: admins may only toggle these, resolved configs are sanitized down to
 * them, and saved configs are stripped to them — so a configured source can
 * never silently no-op. Add a key here only once its adapter exists in
 * `MePortalService.getTasks`.
 */
export const IMPLEMENTED_TASK_SOURCES = [
  "work_orders",
  "maintenance_schedules",
  "alerts",
  "crew_tasks",
] as const;

/** Filter an arbitrary task-source list down to the implemented set, in canonical order. */
export function sanitizeTaskSources(sources: readonly TaskSourceKey[]): TaskSourceKey[] {
  const present = new Set(sources);
  return IMPLEMENTED_TASK_SOURCES.filter((source) => present.has(source));
}

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
  // Strip any source without a serving adapter so persisted configs can never
  // advertise a toggle that no-ops on the task feed.
  taskSources: z
    .array(z.enum(TASK_SOURCES))
    .default([])
    .transform((sources) => sanitizeTaskSources(sources)),
  visibilityScope: z.enum(VISIBILITY_SCOPES).default("vessel"),
  quickActions: z.array(z.string()).default([]),
  filters: jsonRecordSchema.default({}),
  highImpactQuestions: z.record(z.string()).default({}),
  // --- Additive, back-compatible extensions (all optional so already-stored
  // string-array configs keep parsing) ---
  // Which page opens first for this access level. Validated against the
  // level's allowed hubs at resolution time; falls back to a safe default.
  landingRoute: z.string().optional(),
  // Widgets an admin marks mandatory for this access level — users cannot hide
  // them (e.g. Safety Notices). Must be a subset of `widgets`.
  pinnedWidgets: z.array(z.enum(DASHBOARD_WIDGETS)).optional(),
  // Per-widget small settings (e.g. time window, severity filter) keyed by
  // widget id, with an optional personal override layered on top per account.
  widgetSettings: z.record(jsonRecordSchema).optional(),
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

export const DEFAULT_ROLE_DASHBOARD_CONFIGS: Record<string, RoleDashboardConfig> =
  createDefaultRoleDashboardConfigs({ DASHBOARD_WIDGETS, TASK_SOURCES });

export function defaultConfigForRole(roleName: string): RoleDashboardConfig {
  const base = DEFAULT_ROLE_DASHBOARD_CONFIGS[roleName] ?? safeMinimalDashboardConfig();
  return { ...base, taskSources: sanitizeTaskSources(base.taskSources) };
}

/* ------------------------------------------------------------------ *
 * Capability-scoped visibility resolution (multi-role)
 *
 * A multi-role user must NOT have one role's broad scope bleed into a
 * capability granted only by another, narrower role. The merged config is
 * additive for UI surfaces (widgets/quickActions), but DATA access scope is
 * resolved PER capability: the effective scope for a capability is the most
 * permissive scope among ONLY the roles that actually grant that capability.
 * ------------------------------------------------------------------ */

/** Widgets that surface safety-alarm / alert data on the User page. */
export const ALARM_CAPABILITY_WIDGETS: readonly WidgetKey[] = [
  "active_alerts",
  "safety_status",
  "safety_notices",
];

/** Most-permissive scope among the given scopes, or null when the list is empty. */
export function maxScope(scopes: VisibilityScope[]): VisibilityScope | null {
  if (scopes.length === 0) {
    return null;
  }
  let rank = -1;
  for (const scope of scopes) {
    rank = Math.max(rank, VISIBILITY_SCOPE_RANK[scope]);
  }
  return VISIBILITY_SCOPES.find((scope) => VISIBILITY_SCOPE_RANK[scope] === rank) ?? null;
}

/**
 * Effective scope for a single task source across a user's per-role configs.
 * Only roles whose `taskSources` include the source contribute their scope.
 * Returns null when no role grants the source.
 */
export function scopeForSource(
  configs: RoleDashboardConfig[],
  source: TaskSourceKey
): VisibilityScope | null {
  return maxScope(
    configs.filter((c) => c.taskSources.includes(source)).map((c) => c.visibilityScope)
  );
}

/**
 * Effective scope for safety-alarm visibility. Only roles that surface alarm
 * data — via an alarm-bearing widget or the `alerts` task source — contribute
 * their scope. Returns null when no role grants alarm visibility (callers then
 * fall back to the user's explicit vessel assignments only, never fleet-wide).
 */
export function scopeForAlarms(configs: RoleDashboardConfig[]): VisibilityScope | null {
  return maxScope(
    configs
      .filter(
        (c) =>
          c.taskSources.includes("alerts") ||
          c.widgets.some((w) => ALARM_CAPABILITY_WIDGETS.includes(w))
      )
      .map((c) => c.visibilityScope)
  );
}

/**
 * Merge multiple role dashboard configs into one effective config for a
 * multi-role user. Capabilities are ADDITIVE: widgets, taskSources and
 * quickActions are unioned (widgets/taskSources kept in canonical order),
 * visibilityScope takes the MOST permissive (highest rank), and
 * filters/highImpactQuestions are shallow-merged (later configs win). An empty
 * list collapses to the safe-minimal config.
 */
export function mergeDashboardConfigs(configs: RoleDashboardConfig[]): RoleDashboardConfig {
  if (configs.length === 0) {
    return safeMinimalDashboardConfig();
  }
  if (configs.length === 1) {
    return configs[0] ?? safeMinimalDashboardConfig();
  }

  const widgetSet = new Set<WidgetKey>();
  const taskSet = new Set<TaskSourceKey>();
  const quickActions = new Set<string>();
  const pinnedSet = new Set<WidgetKey>();
  let filters: Record<string, JsonValue> = {};
  let highImpactQuestions: Record<string, string> = {};
  let widgetSettings: Record<string, Record<string, JsonValue>> = {};
  let landingRoute: string | undefined;
  let scopeRank = VISIBILITY_SCOPE_RANK.self;

  for (const config of configs) {
    for (const widget of config.widgets) {
      widgetSet.add(widget);
    }
    for (const source of config.taskSources) {
      taskSet.add(source);
    }
    for (const action of config.quickActions) {
      quickActions.add(action);
    }
    for (const widget of config.pinnedWidgets ?? []) {
      pinnedSet.add(widget);
    }
    filters = { ...filters, ...config.filters };
    highImpactQuestions = { ...highImpactQuestions, ...config.highImpactQuestions };
    widgetSettings = { ...widgetSettings, ...(config.widgetSettings ?? {}) };
    if (landingRoute === undefined && config.landingRoute) {
      landingRoute = config.landingRoute;
    }
    scopeRank = Math.max(scopeRank, VISIBILITY_SCOPE_RANK[config.visibilityScope]);
  }

  const visibilityScope: VisibilityScope =
    VISIBILITY_SCOPES.find((scope) => VISIBILITY_SCOPE_RANK[scope] === scopeRank) ?? "vessel";

  return {
    widgets: DASHBOARD_WIDGETS.filter((widget) => widgetSet.has(widget)),
    taskSources: TASK_SOURCES.filter((source) => taskSet.has(source)),
    visibilityScope,
    quickActions: [...quickActions],
    filters,
    highImpactQuestions,
    pinnedWidgets: DASHBOARD_WIDGETS.filter((widget) => pinnedSet.has(widget)),
    widgetSettings,
    landingRoute,
  };
}

/**
 * Per-account personalization layer. Takes the role-resolved (merged) config
 * and the user's personal preferences and returns a NEW config that reflects
 * the user's tweaks — but ONLY ever narrows access, never widens it:
 *
 *   - hiddenWidgets removes widgets the user chose to hide, EXCEPT pinned
 *     widgets (admin-mandated, e.g. Safety Notices) which can never be hidden.
 *   - widgetOrder reorders only widgets the role already grants; unknown or
 *     no-longer-granted widget ids are dropped, and any granted widget the
 *     user didn't mention is appended in its original order so nothing vanishes.
 *   - widgetSettings are shallow-merged per widget on top of the role defaults,
 *     and only for widgets that survive the steps above.
 *   - landingRoute is honored only when it points at a hub the role allows;
 *     otherwise the role default stands.
 *
 * Pure + deterministic so the client can apply the exact same transform for
 * offline/optimistic rendering.
 */
export interface UserDashboardPrefsInput {
  hiddenWidgets?: string[] | undefined;
  widgetOrder?: string[] | undefined;
  widgetSettings?: Record<string, Record<string, JsonValue>> | undefined;
  landingRoute?: string | undefined;
}

export function applyUserDashboardPrefs(
  config: RoleDashboardConfig,
  prefs: UserDashboardPrefsInput | null | undefined,
  allowedLandingRoutes?: readonly string[]
): RoleDashboardConfig {
  if (!prefs) {
    return config;
  }

  const pinned = new Set<WidgetKey>(config.pinnedWidgets ?? []);
  const granted = new Set<WidgetKey>(config.widgets);

  // 1. Hide widgets the user opted out of, but never a pinned (mandatory) one.
  const hidden = new Set<string>(prefs.hiddenWidgets ?? []);
  let visible = config.widgets.filter((w) => !hidden.has(w) || pinned.has(w));

  // 2. Reorder per the user's order, keeping only still-granted widgets and
  //    appending any granted-but-unmentioned widget in its original position.
  if (prefs.widgetOrder && prefs.widgetOrder.length > 0) {
    const visibleSet = new Set<WidgetKey>(visible);
    const ordered: WidgetKey[] = [];
    const seen = new Set<WidgetKey>();
    for (const id of prefs.widgetOrder) {
      if (!isWidgetKey(id)) {
        continue;
      }
      if (granted.has(id) && visibleSet.has(id) && !seen.has(id)) {
        ordered.push(id);
        seen.add(id);
      }
    }
    for (const w of visible) {
      if (!seen.has(w)) {
        ordered.push(w);
      }
    }
    visible = ordered;
  }

  // 3. Shallow-merge per-widget settings for surviving widgets only.
  let widgetSettings = config.widgetSettings;
  if (prefs.widgetSettings) {
    const survivors = new Set<WidgetKey>(visible);
    const merged: Record<string, Record<string, JsonValue>> = { ...(config.widgetSettings ?? {}) };
    for (const [widgetId, settings] of Object.entries(prefs.widgetSettings)) {
      if (!isWidgetKey(widgetId) || !survivors.has(widgetId)) {
        continue;
      }
      merged[widgetId] = { ...(merged[widgetId] ?? {}), ...settings };
    }
    widgetSettings = merged;
  }

  // 4. Honor a personal landing route ONLY when the caller supplies an explicit
  //    allow-list and the route is in it. Fail-closed: with no allow-list a
  //    personal landingRoute is ignored so prefs can never widen where the role
  //    drops the user (intersect-only contract).
  let landingRoute = config.landingRoute;
  if (prefs.landingRoute && allowedLandingRoutes?.includes(prefs.landingRoute)) {
    landingRoute = prefs.landingRoute;
  }

  return {
    ...config,
    widgets: visible,
    widgetSettings,
    landingRoute,
  };
}
