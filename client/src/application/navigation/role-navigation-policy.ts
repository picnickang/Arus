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

import { Gauge, Flag } from "lucide-react";
import {
  getCategoryById,
  type NavigationCategory,
} from "@/config/navigationConfig";
import type { NavRoleId, PortalKind } from "@/domain/navigation/types";

/**
 * The five primary admin categories surfaced in the simplified pilot
 * nav. Order matches the mockup (left → right).
 *
 * These ids reference categories already declared in
 * `navigationConfig.navigationCategories`; the policy layer does NOT
 * own category content (icons, hub routes, children) — it only owns
 * the slice + display-label overrides.
 */
const ADMIN_PRIMARY_CATEGORY_IDS = [
  "maintenance",
  "system",
  "crew",
  "logistics",
  "analytics",
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
 * exposes a drastically reduced surface (Dashboard + Feedback only,
 * per the pilot mockup).
 */
const USER_PRIMARY_CATEGORIES: NavigationCategory[] = [
  {
    id: "user-dashboard",
    name: "Dashboard",
    icon: Gauge,
    hubRoute: "/dashboard",
    description: "Your operational overview",
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
    case "system_admin":
    case "company_admin":
    case "chief_engineer":
    case "fleet_manager":
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
export function getPrimaryCategoriesForRole(
  role: NavRoleId | string | null,
): NavigationCategory[] {
  if (getPortalForRole(role) === "user") {
    return USER_PRIMARY_CATEGORIES;
  }

  const out: NavigationCategory[] = [];
  for (const id of ADMIN_PRIMARY_CATEGORY_IDS) {
    const cat = getCategoryById(id);
    if (!cat) continue;
    const label = ADMIN_LABEL_OVERRIDES[id];
    out.push(label ? { ...cat, name: label } : cat);
  }
  return out;
}

/**
 * Convenience: where should this role land after picking a portal?
 *
 * Both portals currently land on /dashboard — the dashboard itself
 * pivots its content by role. Kept as a function so the landing route
 * can diverge later without touching call sites.
 */
export function getLandingRouteForRole(role: NavRoleId | string | null): string {
  return getPortalForRole(role) === "user" ? "/dashboard" : "/dashboard";
}
