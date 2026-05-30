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
alarm feeds. This was a code-review REJECTION on the User page work.

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
