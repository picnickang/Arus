---
name: Crew edit-clear needs null not undefined
description: Why clearing an optional crew field on edit must send null, not undefined
---

When editing an existing crew member, coercing an empty optional field to
`undefined` does NOT clear the stored value.

**Why:** `useUpdateMutation` (client/src/hooks/useCrudMutations.ts) sends the
payload as-is to PUT, and the crew service's `updateCrew` only normalizes a
field when `data.field !== undefined`. An omitted/undefined key means "leave
untouched", so the previously stored value persists. This silently breaks any
"clear this field" UX (e.g. selecting "No app access" to clear `crew.role_id`).

**How to apply:** On the EDIT path, send an explicit `null` for cleared
optional/nullable crew columns (department, watchKeeping, roleId, …). On the
CREATE path `undefined` is fine (nothing to clear). The crew PUT route validates
with `insertCrewSchema.partial()`, and nullable columns accept `null`.
