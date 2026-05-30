---
name: Admin-portal role gating drift
description: Why client admin-write gates must use the explicit write-role set, not getPortalForRole
---

# Admin-portal write-role gating

Server write gates for admin-portal actions (e.g. Attention Inbox
`ATTENTION_INBOX_ROLES`, safety-bulletins `SAFETY_BULLETIN_WRITE_ROLES`)
use this explicit set: `system_admin, company_admin, chief_engineer,
fleet_manager, captain, admin`.

`getPortalForRole` in
`client/src/application/navigation/role-navigation-policy.ts` does NOT
include the literal `"admin"` role — its switch maps system_admin,
company_admin, chief_engineer, fleet_manager, captain → "admin" portal,
and everything else (including `"admin"`) falls through to "user".

**Rule:** When gating an admin-write UI affordance to match a server
write gate, check membership in the same explicit role set, NOT
`getPortalForRole(role) === "admin"`. Otherwise a user with role
`"admin"` is hidden from the UI but accepted by the API (privilege
confusion / drift).

**Why:** Found during the safety-bulletins authoring form review — the
client first used `getPortalForRole` while the server allowed `"admin"`,
so the two disagreed for that one role.

**How to apply:** Keep the client role set a literal copy of the server
`*_WRITE_ROLES` const (there is no shared client/server constant for
this today), and add a comment on each pointing at the other.
