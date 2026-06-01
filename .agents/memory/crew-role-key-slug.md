---
name: Crew role key is a snake_case slug
description: Why crew-admin Roles & Dashboards can show empty lists and "doesn't work"
---

The crew role `name` is a machine key constrained server-side to
`/^[a-z0-9_]+$/` (length 2-50). The Roles & Dashboards admin tab's
create form must produce a value that satisfies this, otherwise
`POST /api/admin/crew/roles` returns 400 and no role is ever stored.

**Debugging signal:** if `/api/admin/crew/roles` and
`/api/admin/role-dashboards` both return `[]`, suspect that role
creation is silently failing validation, NOT that roles need
seeding. role-dashboards are empty because they depend on roles
existing.

**Why:** roles in this app are user-created (no auto-seed of the
config role templates into the `roles` table), so a fresh org has
zero roles until someone successfully creates one through the UI.

**How to apply:** keep the create form auto-deriving the key from
the display name (slugify) so non-technical users never hit the
regex wall; never loosen the backend regex — the key is used as a
stable identifier.
