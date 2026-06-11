---
name: Crew role catalog is name-keyed
description: How the editable crew role (position/rank) catalog links to crew rows and what that forces on rename/delete.
---

The crew ROLE catalog (`crew_roles`, `/api/crew-roles`) is the editable list of
crew POSITIONS (Captain, Chief Engineer, Bosun…) that drives roster grouping and
the Add/Edit Crew dropdown. It is deliberately SEPARATE from RBAC roles
(`/api/roles`, `crew.roleId`).

The link to crew is by NAME, not id: `crew.rank` is a free-text column storing the
role's display name. There is intentionally no `crewRoleId` FK (the column predates
the catalog and the task kept it).

**Why:** keeps existing/legacy crew rows (whose rank may be free text not in the
catalog) working with a "Other"/fallback grouping, and avoids a schema migration of
the rank column.

**How to apply:**

- Renaming a role MUST update every `crew.rank` on the old name to the new name,
  in the same transaction as the `crew_roles` update — otherwise crew detach into
  uncategorized legacy text and the delete guard stops seeing them.
- The in-use delete guard counts crew by `rank == role.name` (org-scoped) and
  returns 409 when > 0.
- Backend gates: reads require `crew_members:view`, mutations require
  `crew_members:edit` (matches the UI `canManageCrew = canEdit("crew_members")`).
  Note crew-alerts routes have NO permission gate despite the task spec implying so.
