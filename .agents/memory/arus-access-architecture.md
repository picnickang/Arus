---
name: ARUS access architecture
description: How admin-portal / hub access is layered — what enforces what — so future changes target the right boundary.
---

# ARUS access architecture

**Rule:** In the React client, route guards (e.g. `AdminPortalRouteGuard` in `client/src/App.tsx`) and nav filtering (`BottomNav`, `role-navigation-policy.ts`) are a **UX layer only**. The real authorization boundary is server-side: feature APIs use `requirePermission(resource, action)` (`server/domains/permissions/middleware`) and admin mutation routes use `requireRole(...)`. The client comment at `App.tsx` ~L122 states this explicitly.

**Hub-admin grant (`users.hubAdmin` / `users.hubAccess`) is a NAVIGATION/VISIBILITY concept, not a data-access boundary.** Granting/revoking hub-admin or editing the per-admin hub allow-list only changes which admin-portal hubs render in the UI. It does NOT change what data APIs a user can call — that is governed independently by their RBAC role/permissions. To actually revoke data access you change the role, not the hub grant.

**Super-admin detection is by primary `users.role` string** via `isSuperAdminRole` (`shared/role-dashboard.ts`), used consistently in `/api/permissions/me`, the nav policy, and `crew-admin-service.setHubAccess`. Assigned/secondary RBAC roles are NOT consulted for super-admin status — keep any new super-admin checks on the primary role for consistency.

**Why:** A reviewer can mistake the hub-admin grant for "broken access control" (expecting deny-by-default backend middleware per hub). That is a category error: hubs are navigation groupings over features that already enforce their own RBAC. Deeper per-hub backend authorization + comprehensive route guarding would be a separate, larger task.

**How to apply:** If a task asks to *hide/show* hubs or control admin-portal navigation → frontend policy + the `hubAdmin`/`hubAccess` grant. If a task asks to *block data/actions* → server RBAC (`requirePermission`/`requireRole`/role changes), do not rely on hub gating.
