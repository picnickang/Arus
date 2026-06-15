/**
 * Centralized role scenarios + mobile-readiness screen marker resolution.
 *
 * Single source of truth for the (role, permissions, reachable routes) matrix
 * and the route → `mobile-readiness-screen-{marker}` mapping, consumed by
 * nav-matrix, control-crawl, and the role/smoke lanes. Lifted behaviour-
 * preserving from `mobile-readiness-control-crawl.spec.ts`.
 */

import { getMobileReadinessExpectedScreen } from "../../../client/src/features/mobile-readiness/mobile-readiness-route-contract";
import type { PermissionMatrix } from "./spa-auth";

/** Admin-capable role permission matrix (mirrors the controls an admin exposes). */
export const CRAWL_ADMIN_PERMISSIONS: PermissionMatrix = {
  crew_members: { view: true, create: true, edit: true, delete: true, export: true },
  inventory: { view: true, create: true, edit: true, delete: true, export: true },
  permission_management: { view: true, edit: true },
  safety_bulletins: { view: true, create: true },
  vessels: { view: true, edit: true },
  work_orders: { view: true, create: true, edit: true, delete: true, export: true },
};

/** Routes only admin-capable roles can reach; non-admin roles redirect to `/`. */
export const ADMIN_ONLY_REDIRECT_ROUTES: readonly string[] = [
  "/attention-inbox",
  "/feedback-review",
  "/admin/access-diagnostic",
];

/** The full admin route set walked by the control crawl. */
const ADMIN_ROUTES: readonly string[] = [
  "/",
  "/fleet",
  "/vessel-intelligence/mv-atlas/overview",
  "/vessel-intelligence/mv-atlas/diagrams",
  "/pdm-platform",
  "/pdm/equipment/port-generator",
  "/pdm/equipment/port-generator/telemetry",
  "/work-orders",
  "/work-orders/so-4481",
  "/logs",
  "/crew-management",
  "/logistics",
  "/system",
];

export interface RoleScenario {
  role: string;
  adminCapable: boolean;
  /** Mocked `/api/permissions/me` matrix — `CRAWL_ADMIN_PERMISSIONS` or `{}`. */
  permissions: PermissionMatrix;
  /** Routes the role can reach without being redirected. */
  startRoutes: string[];
  /** Admin-only routes this role is redirected away from (empty for admins). */
  adminOnlyRedirectRoutes: string[];
}

export const ROLE_SCENARIOS: RoleScenario[] = [
  {
    role: "super_admin",
    adminCapable: true,
    permissions: CRAWL_ADMIN_PERMISSIONS,
    startRoutes: [...ADMIN_ROUTES],
    adminOnlyRedirectRoutes: [],
  },
  {
    role: "system_admin",
    adminCapable: true,
    permissions: CRAWL_ADMIN_PERMISSIONS,
    startRoutes: [...ADMIN_ROUTES],
    adminOnlyRedirectRoutes: [],
  },
  {
    role: "deck_officer",
    adminCapable: false,
    permissions: {},
    startRoutes: ["/", "/logs", "/crew-management", "/pdm-platform"],
    adminOnlyRedirectRoutes: [...ADMIN_ONLY_REDIRECT_ROUTES],
  },
  {
    role: "crew_member",
    adminCapable: false,
    permissions: {},
    startRoutes: ["/", "/logs"],
    adminOnlyRedirectRoutes: [...ADMIN_ONLY_REDIRECT_ROUTES],
  },
  {
    role: "viewer",
    adminCapable: false,
    permissions: {},
    startRoutes: ["/", "/logs"],
    adminOnlyRedirectRoutes: [...ADMIN_ONLY_REDIRECT_ROUTES],
  },
];

/** Non-admin roles, for the role-coverage lanes. */
export const NON_ADMIN_ROLE_SCENARIOS = ROLE_SCENARIOS.filter((s) => !s.adminCapable);

/**
 * Resolve the `data-testid` of the mobile-readiness screen a route should land
 * on. Replaces the two duplicated `markerForPath` helpers — nav-matrix passed a
 * `"universal-ops-shell"` fallback (non-null), control-crawl used `null`.
 */
export function expectedScreenTestId(
  path: string,
  opts: { fallback: "universal-ops-shell" }
): string;
export function expectedScreenTestId(path: string, opts?: { fallback?: null }): string | null;
export function expectedScreenTestId(
  path: string,
  opts: { fallback?: "universal-ops-shell" | null } = {}
): string | null {
  const marker = getMobileReadinessExpectedScreen(path);
  if (marker) {
    return `mobile-readiness-screen-${marker}`;
  }
  return opts.fallback ?? null;
}
