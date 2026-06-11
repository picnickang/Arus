---
name: Auth role-name vs permission gates
description: ARUS has two parallel authorization models (role-NAME checks and permission checks) that can disagree, especially in dev mode.
---

# Auth: role-name gates vs permission gates (ARUS)

The app authorizes UI/surfaces two different ways, and they can disagree:

1. **Permission-based** — `useUserPermissions().hasPermission(resource, action)` / `<PermissionGate>`, fed by `permissions` from `GET /api/permissions/me`.
2. **Role-NAME-based** — `useRoleNames().hasAnyRole("system_admin", ...)`, fed by the `roles[].name` array from the same endpoint. Used by e.g. `crew-management.tsx` admin tabs (mirrors server `requireCrewAdminRole`) and the navigation pivot `getPortalForRole(role)` in `role-navigation-policy.ts`.

## The dev-mode trap

With `NODE_ENV=development`, `GET /api/permissions/me` (`server/domains/permissions/routes.ts`) short-circuits: it grants **every permission = true** but reports a single role. If that role NAME is not an admin-portal role, permission-based gates pass while role-name gates FAIL — so admin-only tabs/nav silently vanish in dev even though "everything is permitted". (Symptom: logged in as admin@example.com, Crew Management showed only the roster, no admin tabs.)

**Why:** dev grants superuser _permissions_ but the _role name_ must also be an admin-portal role for role-name gates to agree. The dev auth bypass already authenticates as the admin identity `dev-admin-user`, so the dev role is set to `system_admin`.

**How to apply:** When a feature is visible in prod for admins but not in dev (or vice-versa), check whether it gates on role NAME vs permission, and confirm the dev `/api/permissions/me` role name is in the admin set (`getPortalForRole` cases / crew `ADMIN_ROLES`). Admin-portal role names: `admin, system_admin, company_admin, chief_engineer, fleet_manager, captain`. Tradeoff of the dev fix: dev always resolves to admin, so exercising the reduced user-portal in dev needs a separate mechanism.
