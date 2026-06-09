/**
 * Role → Navigation policy.
 *
 * Single source of truth for "which portal does this role belong to"
 * and "which primary categories show up in the simplified pilot nav".
 *
 * Hexagonal boundary:
 *   - Pure function over types from @/domain/navigation/types.
 *   - Reads category metadata from @/config/navigationConfig (data, not behaviour).
 *   - Returns plain `NavigationCategory[]`; the React layer (BottomNav,
 *     HomePage, Sidebar) renders the output without re-deciding policy.
 *
 * Why this exists: prior to the Minimal UX pass, role→nav mapping lived
 * inside BottomNav.tsx (`ROLE_DEFAULTS`) and was duplicated in HomePage.
 * That violates the "components render state; they do not decide policy"
 * rule. All such checks should now import from here.
 */

import { Gauge, Flag, ListChecks, UserCircle } from "lucide-react";
import { getCategoryById, type NavigationCategory } from "@/config/navigationConfig";
import type { NavRoleId, PortalKind } from "@/domain/navigation/types";
import { isSuperAdminRole } from "@shared/role-dashboard";

export { isSuperAdminRole };

/**
 * The eight primary admin categories surfaced in the operations shell.
 * Order matches `navigationConfig.navigationCategories`.
 *
 * These ids reference categories already declared in
 * `navigationConfig.navigationCategories`; the policy layer does NOT
 * own category content (icons, hub routes, children) — it only owns
 * the slice + display-label overrides.
 */
const ADMIN_PRIMARY_CATEGORY_IDS = [
  "operations",
  "fleet",
  "maintenance",
  "crew",
  "logistics",
  "records",
  "analytics",
  "system",
] as const;

/**
 * Display-label overrides applied only when rendering through this
 * policy. The underlying category objects are untouched (other call
 * sites that import `navigationCategories` directly keep the original
 * names — e.g. "System", "Crew", "Analytics").
 */
const ADMIN_LABEL_OVERRIDES: Record<string, string> = {
  system: "System Admin",
  crew: "Crew Management",
  analytics: "AI Analytics",
};

/**
 * User portal categories. Synthetic — they do not correspond to any
 * row in `navigationCategories` because the user portal intentionally
 * exposes a drastically reduced surface, per the Phase 2 target:
 * Dashboard, Assigned Tasks, Feedback / Flags, Profile.
 *
 * Each `hubRoute` points to a real, non-hub-gated route (`/`,
 * `/my-tasks`, `/feedback`, `/profile`) so a normal user can reach
 * every item without tripping the admin-portal route guard.
 */
const USER_PRIMARY_CATEGORIES: NavigationCategory[] = [
  {
    id: "user-dashboard",
    name: "Dashboard",
    icon: Gauge,
    hubRoute: "/",
    description: "Your operational overview",
    children: [],
  },
  {
    id: "user-tasks",
    name: "Assigned Tasks",
    icon: ListChecks,
    hubRoute: "/my-tasks",
    description: "Work assigned to you",
    children: [],
  },
  {
    id: "user-feedback",
    name: "Feedback / Flags",
    icon: Flag,
    hubRoute: "/feedback",
    description: "Submit feedback or flag a concern",
    children: [],
  },
  {
    id: "user-profile",
    name: "Profile",
    icon: UserCircle,
    hubRoute: "/profile",
    description: "Your account and password",
    children: [],
  },
];

/**
 * Map a role identifier to the portal it belongs to.
 *
 * Admin portal: roles that own configuration, fleet ops, or maintenance
 *   command (chief_engineer, fleet_manager, system_admin, company_admin,
 *   captain).
 * User portal: operational/read-only roles (deck_officer, viewer) plus
 *   any unknown role — defaults to the simpler surface so we never
 *   accidentally expose admin tooling to an un-classified user.
 */
export function getPortalForRole(role: NavRoleId | string | null): PortalKind {
  switch (role) {
    case "super_admin":
    case "admin":
    case "system_admin":
    case "company_admin":
    case "chief_engineer":
    case "fleet_manager":
    case "vessel_master":
    case "captain":
      return "admin";
    case "deck_officer":
    case "viewer":
    default:
      return "user";
  }
}

/**
 * Return the primary (top-level) navigation categories for the given
 * role, in display order, with labels already overridden where the
 * pilot mockup requires it.
 *
 * Callers (BottomNav, future Sidebar, HomePage hero grid) must render
 * exactly these in this order — they must NOT re-filter, re-sort, or
 * decide visibility themselves.
 */
export function getPrimaryCategoriesForRole(role: NavRoleId | string | null): NavigationCategory[] {
  if (getPortalForRole(role) === "user") {
    return USER_PRIMARY_CATEGORIES;
  }
  return getAdminPrimaryCategories();
}

/**
 * The admin portal's primary categories (label-overridden), independent
 * of role. Used by hub-access gating where the portal decision is driven
 * by the explicit hub-admin grant rather than the role→portal map.
 */
export function getAdminPrimaryCategories(): NavigationCategory[] {
  const out: NavigationCategory[] = [];
  for (const id of ADMIN_PRIMARY_CATEGORY_IDS) {
    const cat = getCategoryById(id);
    if (!cat) {
      continue;
    }
    const label = ADMIN_LABEL_OVERRIDES[id];
    out.push(label ? { ...cat, name: label } : cat);
  }
  return out;
}

/**
 * Whether the viewer may access the admin portal (its hubs).
 *
 * Hub access is an explicit per-account grant (`hubAdmin`), NOT an
 * automatic property of the role. Contract:
 *   - Super-admin roles are always-on (they own grant/revoke and are
 *     never lockable out), regardless of `ready`.
 *   - While permissions are still loading (`ready === false`) we fall
 *     back to the legacy role→portal map so the first paint is not a
 *     blank/locked admin shell for an existing admin user.
 *   - Once ready, the server-computed `hubAdmin` flag is authoritative.
 *
 * Pure — the caller passes the local role hint + the resolved grant.
 */
export function isAdminPortalAccess(
  role: NavRoleId | string | null,
  hubAdmin: boolean,
  ready: boolean
): boolean {
  if (isSuperAdminRole(role)) {
    return true;
  }
  if (!ready) {
    return getPortalForRole(role) === "admin";
  }
  return hubAdmin;
}

/**
 * Filter a list of categories down to those whose id is in the hub
 * allow-list. `null`/`undefined` allow-list means "all hubs" (the
 * super-admin / un-restricted case) and returns the input unchanged.
 *
 * Pure — no I/O. The caller supplies the resolved allow-list.
 */
export function filterCategoriesByHubAccess(
  categories: NavigationCategory[],
  hubAccess: readonly string[] | null | undefined
): NavigationCategory[] {
  if (!hubAccess) {
    return categories;
  }
  const allowed = new Set(hubAccess);
  return categories.filter((c) => allowed.has(c.id));
}

/**
 * Intersect a stored BottomNav override (a list of category ids the
 * user has personalised) with the categories the role-navigation
 * policy actually permits for `role`.
 *
 * Contract:
 *   - Returns categories in the user's preferred order, but ONLY for
 *     ids the policy already grants to this role.
 *   - Any id not in the policy's allowed set is dropped silently —
 *     this is the security perimeter that stops a tampered or stale
 *     localStorage value from leaking admin categories into a
 *     user-portal session (follow-up #194).
 *   - If the intersection is empty (e.g. an admin override carried
 *     over after switching to the user portal, or an unknown role),
 *     falls back to the policy default so the bottom nav is never
 *     blank.
 *   - `null` / `undefined` override → policy default, unchanged.
 *
 * Pure — no I/O, no storage access. The caller (BottomNav) reads
 * localStorage and hands the parsed value in.
 */
export function intersectOverrideWithPolicy(
  role: NavRoleId | string | null,
  overrideCategoryIds: readonly string[] | null | undefined
): NavigationCategory[] {
  return intersectOverrideWithCategories(getPrimaryCategoriesForRole(role), overrideCategoryIds);
}

/**
 * Category-list variant of {@link intersectOverrideWithPolicy}: intersect
 * a stored override against an *already-resolved* set of allowed
 * categories (e.g. admin primaries already filtered by hub access),
 * preserving the user's order and never expanding past the allowed set.
 * Falls back to the supplied default when the intersection is empty.
 *
 * Pure — no I/O. `intersectOverrideWithPolicy` is the role-driven wrapper
 * (kept stable for the #194 test suite).
 */
export function intersectOverrideWithCategories(
  policyDefault: NavigationCategory[],
  overrideCategoryIds: readonly string[] | null | undefined
): NavigationCategory[] {
  if (!overrideCategoryIds || overrideCategoryIds.length === 0) {
    return policyDefault;
  }
  const allowedIds = new Set(policyDefault.map((c) => c.id));
  const allowedById = new Map(policyDefault.map((c) => [c.id, c]));
  const intersected: NavigationCategory[] = [];
  const seen = new Set<string>();
  for (const id of overrideCategoryIds) {
    if (!allowedIds.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const cat = allowedById.get(id);
    if (cat) {
      intersected.push(cat);
    }
  }
  return intersected.length > 0 ? intersected : policyDefault;
}

/**
 * Prune a stored BottomNav override to ONLY the category ids the
 * given role is currently allowed to see, preserving the user's
 * preferred order.
 *
 * Companion to `intersectOverrideWithPolicy` — that helper returns
 * `NavigationCategory[]` for rendering, this one returns `string[]`
 * for writing back to storage. The BottomNav uses it to self-heal a
 * stored override that contains a *mix* of allowed and disallowed
 * ids (e.g. an admin's `[maintenance, system, user-dashboard]` after
 * switching to the user portal): we keep `user-dashboard`, drop the
 * rest, and persist the cleaned list so the disallowed ids cannot
 * resurface in a future surface that reads the raw key.
 *
 * Returns `null` to signal "no rewrite needed" — either there was no
 * override, or the existing override already exactly matches the
 * policy-allowed subset. Returns an array (possibly empty) when the
 * caller should overwrite the stored value.
 */
export function pruneOverrideToPolicyIds(
  role: NavRoleId | string | null,
  overrideCategoryIds: readonly string[] | null | undefined
): string[] | null {
  if (!overrideCategoryIds || overrideCategoryIds.length === 0) {
    return null;
  }
  const allowedIds = new Set(getPrimaryCategoriesForRole(role).map((c) => c.id));
  const pruned: string[] = [];
  const seen = new Set<string>();
  for (const id of overrideCategoryIds) {
    if (allowedIds.has(id) && !seen.has(id)) {
      seen.add(id);
      pruned.push(id);
    }
  }
  // Already clean (same length, same order, every id allowed) — no
  // rewrite needed.
  const unchanged =
    pruned.length === overrideCategoryIds.length &&
    pruned.every((id, i) => id === overrideCategoryIds[i]);
  return unchanged ? null : pruned;
}

/**
 * Resolve the authoritative role that drives the User/Admin page pivot
 * from the caller's *server-assigned* role names (the DB roles returned
 * by `/api/permissions/me`).
 *
 * Contract:
 *   - When the server has assigned one or more roles, those win: an
 *     admin-portal role is preferred when the user holds several (so a
 *     user with both `deck_officer` and `captain` lands on the admin
 *     surface), otherwise the first server role is used.
 *   - `fallback` (a locally-stored role hint from localStorage) is used
 *     ONLY when the server roles are unavailable (still loading, or the
 *     `/api/permissions/me` call errored). This keeps the DB the source
 *     of truth while preventing a blank pivot during the first paint.
 *
 * Pure — no I/O. The caller reads localStorage / the permissions context
 * and passes the values in.
 */
export function resolveEffectiveRole(
  serverRoleNames: readonly string[],
  fallback: NavRoleId | string | null
): NavRoleId | string | null {
  if (serverRoleNames.length === 0) {
    return fallback;
  }
  const adminRole = serverRoleNames.find((r) => getPortalForRole(r) === "admin");
  return adminRole ?? serverRoleNames[0] ?? fallback;
}

/**
 * Convenience: where should this role land after picking a portal?
 *
 * Both portals currently land on / (the Command Center HomePage) —
 * which pivots its content by role. Kept as a function so the landing
 * route can diverge later without touching call sites.
 */
export function getLandingRouteForRole(role: NavRoleId | string | null): string {
  return getPortalForRole(role) === "user" ? "/" : "/";
}
