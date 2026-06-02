---
name: Role-template grant drift on existing orgs
description: Why adding a permission to a default role template does not reach orgs that were already seeded
---

# Role-template grant changes don't reach existing orgs

`provisionTemplatesForOrg(orgId)` (server/domains/permissions/repository.ts)
**only creates missing roles** — it never adds/updates permission grants on roles
that already exist. So when a resource/action is added to a role in
`server/config/default-role-templates.ts`, every org seeded *before* that change
keeps the old grant set. Admins silently lose access even though the template now
says they should have it (there is no admin wildcard bypass in the permission
service).

**Why:** provisioning is "create-if-missing", and grants are written once at role
creation time from the template snapshot; later template edits are not replayed.

**How to apply:** any time you change a template's `permissions`, ship an
idempotent backfill for existing orgs — do not assume the template edit is enough.
`backfillPdmTemplateGrantsForOrg()` is the reference pattern: insert only
entirely-absent grant rows (setPermissionGrant is check-then-write; there's a
unique index on role_id+resource_code+action_code), never flip a deliberate
isGranted=false, match the role by templateId first and only fall back to name
for legacy roles with a null templateId. Compiled permissions are cached
in-process for 5 min (service.ts CACHE_TTL_MS), so admins re-login or wait after
a backfill.
