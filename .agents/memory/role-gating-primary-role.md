---
name: Role-name gating vs primary role
description: Why client role-name gates can diverge from backend authorization in ARUS, and how to keep them in lockstep.
---

# Client role gates must include the user's PRIMARY role

`server/middleware/role-auth.ts` `requireRole(...allowed)` authorizes on
**only** `user.role?.toLowerCase()` — the single primary `users.role` column.
It never consults `user_role_assignments`.

`GET /api/permissions/me` builds its `roles` array from `mapped.roles`, which
comes purely from `user_role_assignments` (via `compileUserPermissions` + the
mapper). The primary `users.role` was historically dropped from that array.

**Why this matters:** a top admin whose authority is the primary role
(`admin`/`company_admin`/`system_admin`) with NO matching assignment row gets
`roles: []` from `/api/permissions/me`. Any client gate using
`useRoleNames().hasAnyRole(...)` then evaluates false and hides admin-only UI
(e.g. the crew "Access & Login" tab) even though the backend would authorize
the same user. The mismatch is silent.

**How to apply:** when a backend route is gated by `requireRole(...)`, the
client gate guarding the same surface must derive its roles from a source that
includes the primary `users.role`. `/api/permissions/me` now merges the primary
role into its `roles` array (case-insensitive dedupe, prefers org-role
metadata). Do NOT switch the crew-admin gate to `hubAdmin`/capability checks —
that would widen who is authorized beyond what `requireRole` allows.
