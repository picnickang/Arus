/* ------------------------------------------------------------------ *
 * Protected built-in roles + hub access policy
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
export const SUPER_ADMIN_ROLE_KEYS = ["super_admin", "system_admin", "company_admin"] as const;

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
  if (value == null) {
    return false;
  }
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
  if (rank == null) {
    return "";
  }
  return rank
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Suggest a default access level for a rank, honouring an optional editable
 * override map. Unknown ranks → "crew_member"; missing rank → read-only.
 */
export function defaultAccessLevelForRank(
  rank: string | null | undefined,
  overrides?: Record<string, string>
): string {
  const key = normalizeRankKey(rank);
  if (!key) {
    return LEAST_PRIVILEGED_ACCESS_LEVEL;
  }
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

const HUB_ID_SET: ReadonlySet<string> = new Set(HUB_IDS);
const SUPER_ADMIN_ROLE_KEY_SET: ReadonlySet<string> = new Set(SUPER_ADMIN_ROLE_KEYS);
const ADMIN_CAPABLE_ROLE_KEY_SET: ReadonlySet<string> = new Set(ADMIN_CAPABLE_ROLE_KEYS);
const ADMIN_GRANT_ELIGIBLE_ROLE_KEY_SET: ReadonlySet<string> = new Set(
  ADMIN_GRANT_ELIGIBLE_ROLE_KEYS
);

export function isHubId(value: string): value is HubId {
  return HUB_ID_SET.has(value);
}

/** A super-admin role is always a full-hub admin and cannot be edited/revoked. */
export function isSuperAdminRole(role: string | null | undefined): boolean {
  if (role == null) {
    return false;
  }
  const key = role.trim().toLowerCase();
  return SUPER_ADMIN_ROLE_KEY_SET.has(key);
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
  if (role == null) {
    return false;
  }
  const key = role.trim().toLowerCase();
  return ADMIN_CAPABLE_ROLE_KEY_SET.has(key);
}

/** Whether a role is eligible to be granted hub-admin access. */
export function isAdminGrantEligibleRole(role: string | null | undefined): boolean {
  if (role == null) {
    return false;
  }
  const key = role.trim().toLowerCase();
  return ADMIN_GRANT_ELIGIBLE_ROLE_KEY_SET.has(key);
}

/**
 * Normalise a requested hub allow-list to its canonical stored form:
 *   - drop unknown ids, dedupe;
 *   - an empty result or a full set both collapse to `null` (= all hubs).
 */
export function normalizeHubAccess(
  hubAccess: readonly string[] | null | undefined
): string[] | null {
  if (!hubAccess) {
    return null;
  }
  const valid = [...new Set(hubAccess.filter(isHubId))];
  if (valid.length === 0 || valid.length === HUB_IDS.length) {
    return null;
  }
  return valid;
}

/**
 * Effective hub-admin flag for a user given their role name(s) and stored flag.
 * Super-admins are always-on; everyone else uses the stored grant.
 */
export function resolveHubAdmin(roleNames: readonly string[], storedHubAdmin: boolean): boolean {
  if (roleNames.some((r) => isSuperAdminRole(r))) {
    return true;
  }
  if (!storedHubAdmin) {
    return false;
  }
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
  storedHubAccess: readonly string[] | null
): string[] | null {
  if (roleNames.some((r) => isSuperAdminRole(r))) {
    return null;
  }
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
  hubAccess: readonly string[] | null | undefined
): { hubAdmin: boolean; hubAccess: string[] | null } {
  if (!hubAdmin) {
    return { hubAdmin: false, hubAccess: null };
  }
  if (hubAccess == null) {
    return { hubAdmin: true, hubAccess: null };
  }
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
  userStoredHubAdmin: boolean
): boolean {
  if (roles.some((r) => isSuperAdminRole(r.name))) {
    return true;
  }
  if (roles.some((r) => r.hubAdmin && isAdminGrantEligibleRole(r.name))) {
    return true;
  }
  if (userStoredHubAdmin && roles.some((r) => isAdminGrantEligibleRole(r.name))) {
    return true;
  }
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
  userStoredHubAccess: readonly string[] | null
): string[] | null {
  if (roles.some((r) => isSuperAdminRole(r.name))) {
    return null;
  }
  if (!resolveEffectiveHubAdmin(roles, userStoredHubAdmin)) {
    return null;
  }

  const granted = new Set<string>();
  let anyFull = false;

  for (const r of roles) {
    if (!r.hubAdmin || !isAdminGrantEligibleRole(r.name)) {
      continue;
    }
    if (r.hubAccess == null) {
      anyFull = true;
    } else {
      for (const h of r.hubAccess) {
        if (isHubId(h)) {
          granted.add(h);
        }
      }
    }
  }

  if (userStoredHubAdmin && roles.some((r) => isAdminGrantEligibleRole(r.name))) {
    if (userStoredHubAccess == null) {
      anyFull = true;
    } else {
      for (const h of userStoredHubAccess) {
        if (isHubId(h)) {
          granted.add(h);
        }
      }
    }
  }

  if (anyFull) {
    return null;
  }
  const valid = [...granted].filter(isHubId);
  if (valid.length === HUB_IDS.length) {
    return null;
  }
  return valid;
}
