---
name: Crew rank ↔ crew_roles matching needs normalization
description: Why matching a crew member's rank to its crew_roles row by exact name silently fails
---

Two unrelated "role" systems exist — don't confuse them:

- Admin roles in the `roles` table (`/api/admin/crew/roles`): `name` is a
  snake*case slug constrained to `/^[a-z0-9*]+$/` (see crew-role-key-slug.md).
- Crew config roles in the `crew_roles` table (`/api/crew-roles`): `name` is
  Title Case display text, e.g. "Captain", "Chief Engineer".

`crew.rank` is stored INCONSISTENTLY across seed/import paths — observed values
include lowercase ("captain"), Title Case ("Chief Engineer"), and snake_case
slugs ("first_officer", "navigator", "deckhand"). So matching a crew member to
its `crew_roles` row by `role.name === crew.rank` silently matches nothing for
most crew.

**Rule:** match rank → crew*role on a normalized key:
`value.toLowerCase().replace(/\s+/g, "*")`. The client already does this in
`buildRoleLookup`via`normRoleKey`(exported from`client/src/features/crew/lib/crewManagementUtils.ts`). Any backend feature that
joins crew.rank to crew_roles (e.g. role document compliance) must replicate the
same normalization or it returns empty.

**Why:** discovered building per-role required-documents compliance — the
endpoint returned `[]` even with requirements set on "Captain", because the
Captain crew had `rank = "captain"`.

**How to apply:** when correlating crew.rank with crew_roles, normalize BOTH
sides with normRoleKey. Keep client and any server copy of the normalizer in
lockstep (currently duplicated, not shared across the client/server boundary).
