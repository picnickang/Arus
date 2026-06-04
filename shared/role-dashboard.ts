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
  filters: z.record(z.unknown()).default({}),
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
  widgetSettings: z.record(z.record(z.unknown())).optional(),
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
  "super_admin",
  "system_admin",
  "company_admin",
  "admin",
  "fleet_manager",
  "captain",
  "chief_engineer",
  "supervisor",
  "technician",
  "vessel_master",
  "crew_member",
  "logistics_user",
  "procurement_user",
  "safety_officer",
  "maintenance_planner",
  "viewer",
] as const;

export type ProtectedRoleKey = (typeof PROTECTED_ROLE_KEYS)[number];

/** Roles that carry admin-capability for lockout-protection purposes. */
export const ADMIN_CAPABLE_ROLE_KEYS = [
  "super_admin",
  "admin",
  "system_admin",
  "company_admin",
] as const;

/**
 * The TRUE super-admin tier. These roles bypass per-hub gating (all hubs),
 * are always full hub-admins, and are the ONLY roles allowed to edit
 * permissions / access-level definitions. Deliberately EXCLUDES the regular
 * `admin` access level, which reaches the admin hub but is otherwise hub-gated
 * to its explicit allow-list and cannot edit permissions.
 */
export const SUPER_ADMIN_ROLE_KEYS = [
  "super_admin",
  "system_admin",
  "company_admin",
] as const;

/* ------------------------------------------------------------------ *
 * Curated access levels (user-facing permission roles)
 *
 * A SHORT curated set presented as the access-level choices, distinct from
 * maritime ranks. Each maps to an existing protected role key underneath.
 * ------------------------------------------------------------------ */

export interface AccessLevelDef {
  key: string;
  label: string;
  description: string;
}

export const ACCESS_LEVELS: readonly AccessLevelDef[] = [
  {
    key: "super_admin",
    label: "Super Admin",
    description:
      "Full control of every hub and all permissions. The only level that can edit access levels and permissions.",
  },
  {
    key: "admin",
    label: "Admin",
    description:
      "Reaches the admin hub plus any hubs explicitly granted on this page. Cannot edit permissions.",
  },
  {
    key: "manager",
    label: "Manager",
    description: "Department oversight with broad visibility. No admin hub.",
  },
  {
    key: "crew_member",
    label: "Crew",
    description: "Personal dashboard and assigned tasks for day-to-day work.",
  },
  {
    key: "viewer",
    label: "Read-only",
    description: "View-only access with no edit rights.",
  },
] as const;

export const ACCESS_LEVEL_KEYS = ACCESS_LEVELS.map((a) => a.key);

/** The least-privileged sensible access level for brand-new crew profiles. */
export const LEAST_PRIVILEGED_ACCESS_LEVEL = "viewer";

export function isAccessLevelKey(value: string | null | undefined): boolean {
  if (value == null) return false;
  return ACCESS_LEVEL_KEYS.includes(value.trim().toLowerCase());
}

/**
 * Default Rank → Access Level mapping used to SUGGEST a sensible access level
 * when a rank is picked, and to drive the existing-crew backfill. Always
 * overridable per profile; this is only the default. Ranks not listed fall
 * back to the least-privileged sensible "crew_member" level (a real crew
 * person), while a profile with no rank at all defaults to read-only.
 */
export const DEFAULT_RANK_TO_ACCESS_LEVEL: Record<string, string> = {
  super_admin: "super_admin",
  system_admin: "super_admin",
  company_admin: "super_admin",
  admin: "admin",
  fleet_manager: "manager",
  captain: "manager",
  vessel_master: "manager",
  chief_engineer: "manager",
  supervisor: "manager",
  safety_officer: "manager",
  maintenance_planner: "manager",
  technician: "crew_member",
  logistics_user: "crew_member",
  procurement_user: "crew_member",
  crew_member: "crew_member",
  viewer: "viewer",
};

/** Normalise an arbitrary rank/role label into a snake_case lookup key. */
export function normalizeRankKey(rank: string | null | undefined): string {
  if (rank == null) return "";
  return rank.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Suggest a default access level for a rank, honouring an optional editable
 * override map. Unknown ranks → "crew_member"; missing rank → read-only.
 */
export function defaultAccessLevelForRank(
  rank: string | null | undefined,
  overrides?: Record<string, string>,
): string {
  const key = normalizeRankKey(rank);
  if (!key) return LEAST_PRIVILEGED_ACCESS_LEVEL;
  const mapped = overrides?.[key] ?? DEFAULT_RANK_TO_ACCESS_LEVEL[key];
  return mapped ?? "crew_member";
}

/* --------------------------- Hub access control --------------------------- */

/**
 * Canonical hub (nav category) ids. Mirrors the 8 navigation categories the
 * client renders. Kept here (icon-free, plain strings) so the server can
 * validate hub allow-lists without importing client-only navigation config.
 */
export const HUB_IDS = [
  "operations",
  "fleet",
  "maintenance",
  "crew",
  "logistics",
  "records",
  "analytics",
  "system",
] as const;
export type HubId = (typeof HUB_IDS)[number];

/**
 * Roles eligible to be GRANTED hub-admin access ("manager or above"). A user
 * whose role is not in this set cannot be ticked as a hub admin. Super-admin
 * roles are a superset and are always-on regardless of the stored flag.
 */
export const ADMIN_GRANT_ELIGIBLE_ROLE_KEYS = [
  "super_admin",
  "admin",
  "system_admin",
  "company_admin",
  "fleet_manager",
  "captain",
  "vessel_master",
  "chief_engineer",
  "supervisor",
  "safety_officer",
  "manager",
] as const;

export function isHubId(value: string): value is HubId {
  return (HUB_IDS as readonly string[]).includes(value);
}

/** A super-admin role is always a full-hub admin and cannot be edited/revoked. */
export function isSuperAdminRole(role: string | null | undefined): boolean {
  if (role == null) return false;
  const key = role.trim().toLowerCase();
  return (SUPER_ADMIN_ROLE_KEYS as readonly string[]).includes(key);
}

/**
 * Whether a role may EDIT permissions / access-level definitions. Restricted to
 * the true super-admin tier — a regular `admin` is excluded. Enforced on both
 * the UI and the API.
 */
export function isPermissionEditorRole(role: string | null | undefined): boolean {
  return isSuperAdminRole(role);
}

/** Whether a role is in the lockout-protected admin-capable set (super OR admin). */
export function isAdminCapableRole(role: string | null | undefined): boolean {
  if (role == null) return false;
  const key = role.trim().toLowerCase();
  return (ADMIN_CAPABLE_ROLE_KEYS as readonly string[]).includes(key);
}

/** Whether a role is eligible to be granted hub-admin access. */
export function isAdminGrantEligibleRole(role: string | null | undefined): boolean {
  if (role == null) return false;
  const key = role.trim().toLowerCase();
  return (ADMIN_GRANT_ELIGIBLE_ROLE_KEYS as readonly string[]).includes(key);
}

/**
 * Normalise a requested hub allow-list to its canonical stored form:
 *   - drop unknown ids, dedupe;
 *   - an empty result or a full set both collapse to `null` (= all hubs).
 */
export function normalizeHubAccess(
  hubAccess: readonly string[] | null | undefined,
): string[] | null {
  if (!hubAccess) return null;
  const valid = [...new Set(hubAccess.filter(isHubId))];
  if (valid.length === 0 || valid.length === HUB_IDS.length) return null;
  return valid;
}

/**
 * Effective hub-admin flag for a user given their role name(s) and stored flag.
 * Super-admins are always-on; everyone else uses the stored grant.
 */
export function resolveHubAdmin(
  roleNames: readonly string[],
  storedHubAdmin: boolean,
): boolean {
  if (roleNames.some((r) => isSuperAdminRole(r))) return true;
  if (!storedHubAdmin) return false;
  // Re-check eligibility at resolution time so a user demoted below the
  // grant-eligible tier (manager or above) loses effective hub-admin even if
  // the stored grant flag was never explicitly revoked on demotion.
  return roleNames.some((r) => isAdminGrantEligibleRole(r));
}

/**
 * Effective hub allow-list for a user. Super-admins always get full access
 * (`null`); everyone else uses their stored (normalised) allow-list.
 */
export function resolveHubAccess(
  roleNames: readonly string[],
  storedHubAccess: readonly string[] | null,
): string[] | null {
  if (roleNames.some((r) => isSuperAdminRole(r))) return null;
  return normalizeHubAccess(storedHubAccess);
}

/* ----------------------- Role-level hub access (CRUD) ---------------------- */

/**
 * The hub-access fields stored on a single ROLE row. `name` is the role's
 * snake_case key (used for super-admin / eligibility checks), `hubAdmin` is the
 * role-level admin flag, and `hubAccess` is the role's enumerated hub allow-list
 * (`null` = "no specific hubs" for a non-admin role, "all hubs" when the role is
 * an admin — see the module doc).
 */
export interface RoleHubFields {
  name: string;
  hubAdmin: boolean;
  hubAccess: readonly string[] | null;
}

/**
 * Normalise a role's requested hub access to its canonical stored form.
 *
 * Role-level semantics differ DELIBERATELY from the user-level
 * `normalizeHubAccess`. `null` is reserved for "all hubs" (an admin role with
 * no explicit list, or one that ticks every hub). An EMPTY explicit list is
 * preserved as `[]` — an admin role with no accessible hubs (lands on the
 * overview with every hub locked) — and must NOT collapse to `null`, or that
 * role would silently inherit all hubs. A non-admin role can never carry hubs.
 */
export function normalizeRoleHubAccess(
  hubAdmin: boolean,
  hubAccess: readonly string[] | null | undefined,
): { hubAdmin: boolean; hubAccess: string[] | null } {
  if (!hubAdmin) return { hubAdmin: false, hubAccess: null };
  if (hubAccess == null) return { hubAdmin: true, hubAccess: null };
  const valid = [...new Set(hubAccess.filter(isHubId))];
  if (valid.length === HUB_IDS.length) {
    return { hubAdmin: true, hubAccess: null };
  }
  return { hubAdmin: true, hubAccess: valid };
}

/**
 * Effective hub-admin flag for a user resolved across ALL their roles plus the
 * existing per-user override. A user is a hub admin when: any role is a
 * super-admin role, OR any grant-eligible role carries `hubAdmin`, OR the
 * per-user override flag is set on a grant-eligible role (the eligibility
 * re-check is preserved so a demoted user loses effective access).
 */
export function resolveEffectiveHubAdmin(
  roles: readonly RoleHubFields[],
  userStoredHubAdmin: boolean,
): boolean {
  if (roles.some((r) => isSuperAdminRole(r.name))) return true;
  if (roles.some((r) => r.hubAdmin && isAdminGrantEligibleRole(r.name))) return true;
  if (userStoredHubAdmin && roles.some((r) => isAdminGrantEligibleRole(r.name))) return true;
  return false;
}

/**
 * Effective hub allow-list for a user resolved across ALL their roles plus the
 * existing per-user override (additive layer). Super-admins always get full
 * access (`null`). Otherwise the union of every grant-eligible admin role's
 * hubs PLUS the per-user override is taken; a contributing source with a `null`
 * list (full) or a union that covers every hub collapses to `null` (all hubs).
 * An empty union returns `[]` (admin with no hubs → lands on the overview with
 * every hub locked). Returns `null` for a non-admin (landing → dashboard).
 */
export function resolveEffectiveHubAccess(
  roles: readonly RoleHubFields[],
  userStoredHubAdmin: boolean,
  userStoredHubAccess: readonly string[] | null,
): string[] | null {
  if (roles.some((r) => isSuperAdminRole(r.name))) return null;
  if (!resolveEffectiveHubAdmin(roles, userStoredHubAdmin)) return null;

  const granted = new Set<string>();
  let anyFull = false;

  for (const r of roles) {
    if (!r.hubAdmin || !isAdminGrantEligibleRole(r.name)) continue;
    if (r.hubAccess == null) {
      anyFull = true;
    } else {
      for (const h of r.hubAccess) if (isHubId(h)) granted.add(h);
    }
  }

  if (userStoredHubAdmin && roles.some((r) => isAdminGrantEligibleRole(r.name))) {
    if (userStoredHubAccess == null) {
      anyFull = true;
    } else {
      for (const h of userStoredHubAccess) if (isHubId(h)) granted.add(h);
    }
  }

  if (anyFull) return null;
  const valid = [...granted].filter(isHubId);
  if (valid.length === HUB_IDS.length) return null;
  return valid;
}

export const DEFAULT_ROLE_DASHBOARD_CONFIGS: Record<string, RoleDashboardConfig> = {
  super_admin: {
    widgets: [...DASHBOARD_WIDGETS],
    taskSources: [...TASK_SOURCES],
    visibilityScope: "fleet",
    quickActions: ["create_work_order", "view_analytics", "manage_roles"],
    filters: {},
    highImpactQuestions: {},
  },
  system_admin: {
    widgets: [...DASHBOARD_WIDGETS],
    taskSources: [...TASK_SOURCES],
    visibilityScope: "fleet",
    quickActions: ["create_work_order", "view_analytics", "manage_roles"],
    filters: {},
    highImpactQuestions: {},
  },
  company_admin: {
    widgets: [...DASHBOARD_WIDGETS],
    taskSources: [...TASK_SOURCES],
    visibilityScope: "fleet",
    quickActions: ["create_work_order", "view_analytics", "manage_roles"],
    filters: {},
    highImpactQuestions: {},
  },
  admin: {
    widgets: [...DASHBOARD_WIDGETS],
    taskSources: [...TASK_SOURCES],
    visibilityScope: "fleet",
    quickActions: ["create_work_order", "view_analytics"],
    filters: {},
    highImpactQuestions: {},
  },
  fleet_manager: {
    widgets: [...DASHBOARD_WIDGETS],
    taskSources: ["work_orders", "maintenance_schedules", "alerts"],
    visibilityScope: "fleet",
    quickActions: ["create_work_order", "view_analytics"],
    filters: {},
    highImpactQuestions: {},
  },
  captain: {
    widgets: [...DASHBOARD_WIDGETS],
    taskSources: ["work_orders", "maintenance_schedules", "alerts", "crew_tasks"],
    visibilityScope: "vessel",
    quickActions: ["create_work_order"],
    filters: {},
    highImpactQuestions: {},
  },
  supervisor: {
    widgets: [
      "current_vessel",
      "shift_status",
      "safety_status",
      "user_tasks",
      "active_alerts",
      "upcoming_maintenance",
    ],
    taskSources: ["work_orders", "maintenance_schedules", "alerts", "crew_tasks"],
    visibilityScope: "department",
    quickActions: ["create_work_order"],
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
    taskSources: ["work_orders", "maintenance_schedules", "alerts", "purchase_requests", "crew_tasks"],
    visibilityScope: "vessel",
    quickActions: ["create_work_order"],
    filters: {},
    highImpactQuestions: {},
  },
  technician: {
    widgets: ["current_vessel", "shift_status", "user_tasks", "upcoming_maintenance", "active_alerts"],
    taskSources: ["work_orders", "maintenance_schedules", "crew_tasks"],
    visibilityScope: "self",
    quickActions: ["complete_work_order"],
    filters: {},
    highImpactQuestions: {},
  },
  vessel_master: {
    widgets: [...DASHBOARD_WIDGETS],
    taskSources: ["work_orders", "maintenance_schedules", "alerts", "service_requests", "crew_tasks"],
    visibilityScope: "vessel",
    quickActions: [],
    filters: {},
    highImpactQuestions: {},
  },
  crew_member: {
    widgets: ["current_vessel", "shift_status", "safety_status", "user_tasks", "safety_notices"],
    taskSources: ["work_orders", "crew_tasks"],
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
  viewer: {
    widgets: ["current_vessel", "safety_status", "safety_notices", "active_alerts"],
    taskSources: [],
    visibilityScope: "self",
    quickActions: [],
    filters: {},
    highImpactQuestions: {},
  },
};

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
  if (scopes.length === 0) return null;
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
  source: TaskSourceKey,
): VisibilityScope | null {
  return maxScope(
    configs.filter((c) => c.taskSources.includes(source)).map((c) => c.visibilityScope),
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
          c.widgets.some((w) => ALARM_CAPABILITY_WIDGETS.includes(w)),
      )
      .map((c) => c.visibilityScope),
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
  if (configs.length === 0) return safeMinimalDashboardConfig();
  if (configs.length === 1) return configs[0] ?? safeMinimalDashboardConfig();

  const widgetSet = new Set<WidgetKey>();
  const taskSet = new Set<TaskSourceKey>();
  const quickActions = new Set<string>();
  const pinnedSet = new Set<WidgetKey>();
  let filters: Record<string, unknown> = {};
  let highImpactQuestions: Record<string, string> = {};
  let widgetSettings: Record<string, Record<string, unknown>> = {};
  let landingRoute: string | undefined;
  let scopeRank = VISIBILITY_SCOPE_RANK.self;

  for (const config of configs) {
    for (const widget of config.widgets) widgetSet.add(widget);
    for (const source of config.taskSources) taskSet.add(source);
    for (const action of config.quickActions) quickActions.add(action);
    for (const widget of config.pinnedWidgets ?? []) pinnedSet.add(widget);
    filters = { ...filters, ...config.filters };
    highImpactQuestions = { ...highImpactQuestions, ...config.highImpactQuestions };
    widgetSettings = { ...widgetSettings, ...(config.widgetSettings ?? {}) };
    if (landingRoute === undefined && config.landingRoute) landingRoute = config.landingRoute;
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
  hiddenWidgets?: string[];
  widgetOrder?: string[];
  widgetSettings?: Record<string, Record<string, unknown>>;
  landingRoute?: string;
}

export function applyUserDashboardPrefs(
  config: RoleDashboardConfig,
  prefs: UserDashboardPrefsInput | null | undefined,
  allowedLandingRoutes?: readonly string[],
): RoleDashboardConfig {
  if (!prefs) return config;

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
      if (granted.has(id as WidgetKey) && visibleSet.has(id as WidgetKey) && !seen.has(id as WidgetKey)) {
        ordered.push(id as WidgetKey);
        seen.add(id as WidgetKey);
      }
    }
    for (const w of visible) {
      if (!seen.has(w)) ordered.push(w);
    }
    visible = ordered;
  }

  // 3. Shallow-merge per-widget settings for surviving widgets only.
  let widgetSettings = config.widgetSettings;
  if (prefs.widgetSettings) {
    const survivors = new Set<WidgetKey>(visible);
    const merged: Record<string, Record<string, unknown>> = { ...(config.widgetSettings ?? {}) };
    for (const [widgetId, settings] of Object.entries(prefs.widgetSettings)) {
      if (!survivors.has(widgetId as WidgetKey)) continue;
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
