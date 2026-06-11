---
name: Multi-role capability scoping
description: How effective data scope must be resolved for users holding more than one role on the User page / me-portal.
---

# Multi-role capability scoping (me-portal / role-dashboard)

Users can hold a primary `users.role` PLUS additive secondary roles
(`user_role_assignments`). Their dashboard config is the union of all role
configs.

**Rule:** the merged config is additive for UI surfaces only
(widgets / quickActions / taskSources presence). DATA ACCESS SCOPE must be
resolved PER capability, never from the single merged max `visibilityScope`.

**Why:** a single merged max scope causes cross-role privilege amplification —
e.g. a fleet-scoped procurement role (which grants only `purchase_requests`)
would bleed fleet visibility into a self-scoped technician's work-order and
alarm feeds. Treat per-capability scope resolution as a security boundary, not
a refactor preference.

**How to apply:**

- Per-source scope = most-permissive scope among ONLY the roles whose
  `taskSources` include that source (`scopeForSource` in
  `shared/role-dashboard.ts`).
- Alarm scope = most-permissive scope among ONLY roles with an alarm-bearing
  widget (`active_alerts` / `safety_status` / `safety_notices`) or the `alerts`
  task source (`scopeForAlarms`).
- `maxScope([])` returns null → caller restricts to the user's explicit vessel
  assignments only, NEVER fleet. An explicit `vesselId=null` assignment still
  grants fleet (deliberate admin grant).
- `me-portal-service` resolves data scope from `resolveEffectiveConfigList`
  (un-merged per-role configs), not the merged config. Only the dashboard's
  vessel-roster reference context may use the merged scope.
- If you add a new data feed to the User page, scope it through a capability
  resolver — do not reach for `config.visibilityScope` of the merged config.

## Credential hardening (same User-page surface)

Non-negotiable controls on this surface — UI-only gating or a missing session
revocation here is a real security defect, not polish:

- **Session invalidation on credential rotation:** any path that changes a
  password (self change in me-portal, admin reset/disable in crew-admin) MUST
  revoke ALL of that user's sessions (delete `admin_sessions` rows) right after
  the update, so pre-change tokens — including the caller's own — die. The
  client that triggered a self-change must then clear its in-memory token and
  re-authenticate; navigating into an authed route reuses a now-dead token (401).
- **Forced password change is server-enforced, not UI-only:** every
  non-credential `/api/me/*` data read calls a guard that throws
  `PASSWORD_CHANGE_REQUIRED` (403) while `users.mustChangePassword` is true.
  The change-password endpoint itself stays unguarded for recovery.
- **Admin lockout covers role lifecycle too:** deactivating or deleting an
  admin-capable role (`ADMIN_CAPABLE_ROLE_KEYS`) is blocked, mirroring the
  last-admin-login guards — not just user login/role-change paths.

## Configurable sets must equal implemented sets

The User-page task feed is config-driven: admins toggle which `TASK_SOURCES`
each role sees. Only sources with a real serving adapter in
`MePortalService.getTasks` may be configurable — keep `IMPLEMENTED_TASK_SOURCES`
as the single source of truth and sanitize configs down to it at every boundary
(schema parse, default resolution, stored-override read, admin UI checkboxes).
**Why:** a toggle that silently materializes nothing is a capability mismatch a
reviewer will (rightly) treat as an incomplete feature, not a minor gap.
