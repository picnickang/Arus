# Predictive-Maintenance Permission Backfill

> **Status:** Operational runbook + rationale for the idempotent PdM permission backfill.
> **Date:** 2026-06-02
> **Code:** `backfillPdmTemplateGrantsForOrg()` in `server/domains/permissions/repository.ts`;
> runnable script `server/scripts/backfill-pdm-permissions.ts`.

---

## 1. Why this exists (root cause)

The default role templates (`server/config/default-role-templates.ts`) grant the
`predictive_maintenance` resource (`view`, `manage_config`, `override`) to the
admin-capable roles:

| Role             | `view` | `manage_config` | `override` |
| ---------------- | ------ | --------------- | ---------- |
| `super_admin`    | ✅     | ✅              | ✅         |
| `admin`          | ✅     | ✅              | ✅         |
| `company_admin`  | ✅     | ✅              | ✅         |
| `chief_engineer` | ✅     | ✅              | —          |
| `captain`        | ✅     | —               | ✅         |
| `chief_officer`  | ✅     | —               | —          |

The PdM lifecycle routes (model deploy/archive/promote/rollback) were converted
from hardcoded role-name checks to the permission grant
`requirePermission("predictive_maintenance", "manage_config")`. The frontend
gates the same surface on the `predictive_maintenance` resource. Both sides now
agree.

**The gap:** `provisionTemplatesForOrg()` only _creates missing roles_ — it
**never adds grants to roles that already exist**. Any organization seeded
_before_ `predictive_maintenance` was added to those templates still has
admin/super_admin roles **without** the grant. Those admins are silently blocked
from PdM lifecycle actions even though the current template says they should have
them. There is no admin wildcard bypass in the permission service, so the only
fix is to write the missing grants.

---

## 2. What the backfill does

For every organization, for each of the four admin-capable template roles
(`super_admin`, `admin`, `company_admin`, `chief_engineer`) that exists in that
org, it ensures the `predictive_maintenance` grants defined in that role's
template are present.

The exact grants are read **from the template config**, so the backfill can
never grant more than the template already defines (e.g. `chief_engineer` gets
`view` + `manage_config` but not `override`, matching the template).

### Safety properties

- **Idempotent.** Only grants with **no row at all** are inserted. Re-running
  after a successful apply is a no-op.
- **No duplicate rows.** Writes go through `setPermissionGrant()`, which
  checks-then-writes (update if a row exists, insert only if absent).
- **Respects deliberate revocations.** If a grant row exists with
  `isGranted = false` (an admin explicitly turned it off), the backfill
  **leaves it untouched** and reports it as `skippedRevoked`. It never silently
  re-enables a revoked permission.
- **Tightly scoped.** Only the `predictive_maintenance` resource and only the
  four admin-capable roles. It never touches normal users and never touches any
  other resource — so it cannot over-grant.

---

## 3. Operator runbook — dry-run → apply (10 steps)

The script defaults to a **dry-run** (no writes). Follow these steps in order.

**1. Dry-run command.**

```bash
npx tsx server/scripts/backfill-pdm-permissions.ts
```

> No `package.json` script was added (per project policy of not editing
> `package.json` without sign-off). If you want a named script later, add
> `"backfill:pdm": "tsx server/scripts/backfill-pdm-permissions.ts"`.

**2. Expected output.** A per-org plan, ending with a "Would grant N" summary.
Nothing is written.

```
[backfill-pdm] mode=DRY-RUN | organizations=2
[backfill-pdm] No writes will be made. Re-run with --apply to write.

  • Acme Marine:
      - role "admin": would grant predictive_maintenance:[view, manage_config, override]
      - role "super_admin": would grant predictive_maintenance:[manage_config]
  ✓ Globex Shipping: already up to date
[backfill-pdm] Done. Would grant 4 grant(s); left 0 revoked grant(s) untouched.
```

**3. Review affected orgs.** Each `•` line is an org that will change; each `✓`
line is already up to date. Confirm only the orgs you expect appear, and that
each listed role is one of the four admin-capable roles (`super_admin`, `admin`,
`company_admin`, `chief_engineer`). Any role named `not present (skipped)` simply
does not exist in that org — nothing is created.

**4. Apply command.**

```bash
npx tsx server/scripts/backfill-pdm-permissions.ts --apply
```

The output mirrors the dry-run but reads `granted` instead of `would grant`.

**5. Confirm inserted grants.** Re-run the **dry-run** (step 1): every org that
changed should now read `✓ already up to date`, and the summary should be
`Would grant 0 grant(s)`. (You can also spot-check the DB:
`SELECT role_id, resource_code, action_code, is_granted FROM permission_grants
WHERE resource_code = 'predictive_maintenance';`)

**6. Confirm no duplicate grants.** Writes go through `setPermissionGrant`
(check-then-write), and the planner only ever lists grants with **no row at
all** — so a second `--apply` is a no-op. Verify there is at most one row per
`(role_id, resource_code, action_code)`:

```sql
SELECT role_id, action_code, COUNT(*)
FROM permission_grants
WHERE resource_code = 'predictive_maintenance'
GROUP BY role_id, action_code HAVING COUNT(*) > 1;   -- expect 0 rows
```

**7. Confirm deliberate revocations were not overwritten.** Any pre-existing
`is_granted = false` row is reported as `left explicitly-revoked …` and **never**
flipped. Confirm such rows still read `false` after `--apply`.

**8. Refresh the permission cache.** Compiled permissions are cached in-memory
per process for **5 minutes** (`service.ts`, `CACHE_TTL_MS`). The script writes
from a separate process, so a running server keeps serving the old matrix until
the entry expires. To pick up grants immediately, restart the server process (or
wait ≤5 min).

**9. Affected admins re-login.** Re-login recompiles permissions, so any admin
who was missing PdM lifecycle access should log out and back in to get it without
waiting for the cache TTL.

**10. Rollback strategy.** The backfill only **inserts** previously-missing
grants — it never deletes or revokes. To undo, revoke the specific grants you
added (set `is_granted = false`, which the backfill will then respect as a
deliberate revocation), e.g.:

```sql
UPDATE permission_grants SET is_granted = false
WHERE resource_code = 'predictive_maintenance' AND role_id = '<role-id>';
```

Then refresh the cache (step 8). Because each apply is reported, you have an exact
list of what was added to scope the rollback.

---

## 3a. Required permission behavior (verified)

| Persona / role                                          | Outcome of backfill                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `super_admin`                                           | Retains full PdM access (template: view + manage_config + override).                  |
| `admin`                                                 | Receives only the template defaults (view + manage_config + override) — nothing more. |
| `company_admin`                                         | Receives intended PdM access (view + manage_config + override).                       |
| `chief_engineer`                                        | Receives view + manage_config (no `override`, matching template).                     |
| Normal users (technician, crew_member, deck_officer, …) | **Never touched** — not in `PDM_BACKFILL_ROLE_NAMES`, so no PdM lifecycle grants.     |
| Viewer / Auditor                                        | **Never touched** — receives no mutation permissions.                                 |
| Existing orgs                                           | Safely handled — only missing grants are inserted; up-to-date orgs are no-ops.        |
| Re-run                                                  | Idempotent — a second apply grants nothing.                                           |

These properties are enforced in the db-free planner
(`server/domains/permissions/pdm-backfill-planner.ts`) and pinned by tests
(§3b).

---

## 3b. Tests

The decision logic is extracted into a **pure, db-free** planner so it can be
unit-tested in the sandbox (importing the repository directly crashes under
cloud-mode db-config init). Run:

```bash
npx jest tests/unit/pdm-backfill-planner.test.ts --forceExit
```

Coverage (`tests/unit/pdm-backfill-planner.test.ts`):

| Property                   | Test                                                        |
| -------------------------- | ----------------------------------------------------------- |
| Dry-run plan               | lists missing grants, `applied=false`                       |
| Apply                      | `applied=true` on every result                              |
| Idempotency                | all grants present → empty plan (no-op)                     |
| No duplicate grants        | an already-granted row is never re-added                    |
| No re-enabling revocations | `is_granted=false` row → `skippedRevoked`, never added      |
| Missing org role           | `roleId=null`, nothing added                                |
| Scope                      | only the four admin roles and only `predictive_maintenance` |

> The end-to-end DB path (`backfillPdmTemplateGrantsForOrg`) is exercised against
> a real database in CI / staging via the dry-run command above — it cannot run
> in the sandbox.

---

## 4. After applying — cache note

Compiled permissions are cached in-memory per process for **5 minutes**
(`server/domains/permissions/service.ts`, `CACHE_TTL_MS`). The backfill writes
directly to the database from a **separate process**, so a running server keeps
serving the old matrix until the cache entry expires.

To pick up the new grants immediately, an affected admin can **re-login**
(re-login recompiles permissions), or wait up to 5 minutes for the cache to
expire. Restarting the server process also clears the cache.

---

## 5. Optional: self-healing on provision (not enabled)

`provisionTemplatesForOrg()` could call `backfillPdmTemplateGrantsForOrg()` so
existing orgs self-heal whenever roles are next listed. This was deliberately
**not** wired in, to avoid surprising write-on-read behavior during a routine
read path. The explicit script keeps the operation auditable and operator-driven.
If self-healing is later desired, call `backfillPdmTemplateGrantsForOrg(orgId,
{ apply: true })` from `provisionTemplatesForOrg()` after the create-missing loop.
