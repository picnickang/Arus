---
name: Permission-editor tier gating (UI must match API)
description: Gating "who can edit access permissions" must use the super-admin TIER, not a single role name, on both UI and API.
---

# Permission-editor gating must use the super-admin tier on BOTH sides

The right to EDIT access permissions / role hub-access is gated by `isPermissionEditorRole()` (== `isSuperAdminRole()`), which matches `SUPER_ADMIN_ROLE_KEYS` (super_admin, system_admin, company_admin) — NOT a single `"super_admin"` string.

- Backend gates: `requireSuperAdminForPermissions` (permissions routes), `requireSuperAdminRole` (crew-admin interface routes).
- Frontend gate (RolePermissionsDialog): `roleNames.some((r) => isPermissionEditorRole(r))` over the signed-in user's roles from `useRoleNames()`.

**Why:** a UI gate of `hasRole("super_admin")` is STRICTER than the backend and falsely locks `system_admin`/`company_admin` into read-only even though the API would accept their edits. A code review caught exactly this lockout.

**How to apply:** any new UI that mirrors a backend super-admin gate must reuse the shared `isPermissionEditorRole`/`isSuperAdminRole` predicate over the user's full role-name list — never a hardcoded single role name. Keep UI and API gate in lockstep.

Related: `applyUserDashboardPrefs(config, prefs, allowedLandingRoutes?)` in `shared/role-dashboard.ts` is intersect-only and **fail-closed** on `landingRoute` — a personal landingRoute is honored ONLY when an explicit `allowedLandingRoutes` allow-list is passed and contains it. `me-portal` getDashboard currently passes none, so personal landingRoute is inert by design (never widens where the role drops the user). Wire a real hub→route allow-list before enabling it.
