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

| Role | `view` | `manage_config` | `override` |
|---|---|---|---|
| `super_admin` | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ |
| `company_admin` | ✅ | ✅ | ✅ |
| `chief_engineer` | ✅ | ✅ | — |
| `captain` | ✅ | — | ✅ |
| `chief_officer` | ✅ | — | — |

The PdM lifecycle routes (model deploy/archive/promote/rollback) were converted
from hardcoded role-name checks to the permission grant
`requirePermission("predictive_maintenance", "manage_config")`. The frontend
gates the same surface on the `predictive_maintenance` resource. Both sides now
agree.

**The gap:** `provisionTemplatesForOrg()` only *creates missing roles* — it
**never adds grants to roles that already exist**. Any organization seeded
*before* `predictive_maintenance` was added to those templates still has
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

## 3. How to run it

The script defaults to a **dry-run** (no writes). Review the plan first, then
re-run with `--apply`.

```bash
# 1. Dry-run — prints exactly what would change, writes nothing.
npx tsx server/scripts/backfill-pdm-permissions.ts

# 2. Apply — writes the missing grants.
npx tsx server/scripts/backfill-pdm-permissions.ts --apply
```

> No `package.json` script was added (per project policy of not editing
> `package.json` without sign-off). Run via `npx tsx` as above. If you want a
> named script later, add `"backfill:pdm": "tsx server/scripts/backfill-pdm-permissions.ts"`.

### Sample dry-run output

```
[backfill-pdm] mode=DRY-RUN | organizations=2
  • Acme Marine:
      - role "admin": would grant predictive_maintenance:[view, manage_config, override]
      - role "super_admin": would grant predictive_maintenance:[manage_config]
  ✓ Globex Shipping: already up to date
[backfill-pdm] Done. Would grant 4 grant(s); left 0 revoked grant(s) untouched.
```

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
