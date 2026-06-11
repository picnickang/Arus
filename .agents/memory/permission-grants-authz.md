---
name: Permission-grants routes need explicit authz
description: Role grant read/write routes must carry requirePermission, not just requireOrgId
---

The `/api/permissions/roles/:id/grants` GET/PUT routes historically had **only**
`requireOrgId` — no role/permission gate. Org-scoping is tenant isolation, NOT
authorization: any authenticated org member could read/mutate role grants.

**Rule:** every permission-management mutation (role grants, role hub-access, etc.)
must carry an explicit gate — `requirePermission("permission_management", "view"|"edit")`
from `server/domains/permissions/middleware.ts` — in addition to `requireOrgId`.

**Why:** a reviewer flagged the grants PUT as broken access control; the per-role
permission-matrix editor made it reachable from the UI. The lockout guard inside
the handler only prevents removing the _last_ manager — it does not stop an
unprivileged caller from editing grants.

**How to apply:** admin/super_admin/company_admin role templates already grant
`permission_management` view/edit/create/delete, so gating does not lock out real
admins. Pre-existing orgs that predate a template change won't auto-reseed (same
caveat as the PdM `manage_config` note in replit.md) — re-run role-template seeding
or grant manually if an admin 403s.

Related: hub-admin/eligibility helpers in `shared/role-dashboard.ts`
(`isSuperAdminRole`, `isAdminGrantEligibleRole`) normalize role names with
`.trim().toLowerCase()` before matching the lowercase allow-lists, so mixed-case
legacy role values still resolve correctly.
