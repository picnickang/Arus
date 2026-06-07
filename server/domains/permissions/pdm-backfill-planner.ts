/**
 * Pure planning logic for the predictive-maintenance permission backfill.
 *
 * Why a separate module
 * ---------------------
 * `server/domains/permissions/repository.ts` imports the live `db` handle at
 * module load, so any test that imports it crashes under the cloud-mode
 * db-config init in the sandbox. This module is intentionally **db-free** so the
 * backfill decision logic can be unit-tested without a database (see
 * `tests/unit/pdm-backfill-planner.test.ts`). The repository's
 * `backfillPdmTemplateGrantsForOrg()` gathers the rows and delegates every
 * decision to `planPdmBackfill()` here.
 *
 * Safety properties enforced here (and asserted by the unit test):
 * - Only INSERTS grants that have no row at all → idempotent, no duplicate rows.
 * - Never flips an existing `isGranted=false` row → a deliberate revocation is
 *   reported as `skippedRevoked` and left alone.
 * - Only the `predictive_maintenance` resource and only the four admin-capable
 *   template roles → cannot over-grant.
 */

/** The four admin-capable template roles the backfill ever touches. */
export const PDM_BACKFILL_ROLE_NAMES = [
  "super_admin",
  "admin",
  "company_admin",
  "chief_engineer",
] as const;

/** The only resource the backfill ever writes. */
export const PDM_RESOURCE_CODE = "predictive_maintenance";

/** Minimal shape of a role template the planner needs (subset of `RoleTemplate`). */
export interface PlannerTemplate {
  id: string;
  name: string;
  /** JSON-encoded array of `{ resource, action }`. */
  permissions: string;
}

/** Minimal shape of an existing org role the planner needs (subset of `Role`). */
export interface PlannerRole {
  id: string;
  name: string;
  templateId: string | null;
}

/** Minimal shape of a permission grant row the planner needs (subset of `PermissionGrant`). */
export interface PlannerGrant {
  resourceCode: string;
  actionCode: string;
  /**
   * `null` is treated the same as `false` (no active grant) — a row that exists
   * but is not actively granted is reported as `skippedRevoked`, never re-added.
   */
  isGranted: boolean | null;
}

export interface PdmBackfillRoleResult {
  roleName: string;
  /** null when the org has no role for this template (nothing to backfill). */
  roleId: string | null;
  /** Grants that had no row at all and were (or would be) inserted. */
  added: Array<{ resource: string; action: string }>;
  /**
   * Grants that exist but are explicitly revoked (isGranted=false). Left
   * untouched so a deliberate revocation is never silently re-enabled.
   */
  skippedRevoked: Array<{ resource: string; action: string }>;
  /** Whether writes were actually performed (false in dry-run). */
  applied: boolean;
}

/**
 * Compute the backfill plan for one org.
 *
 * Pure: given the org's templates, existing roles, and the grants per role, it
 * returns exactly what would (or did, when `apply`) change. The caller performs
 * the writes for every `added` entry; this function performs no I/O.
 */
export function planPdmBackfill(
  templates: readonly PlannerTemplate[],
  existingRoles: readonly PlannerRole[],
  grantsByRoleId: ReadonlyMap<string, readonly PlannerGrant[]>,
  apply: boolean,
): PdmBackfillRoleResult[] {
  const results: PdmBackfillRoleResult[] = [];

  for (const roleName of PDM_BACKFILL_ROLE_NAMES) {
    const template = templates.find((t) => t.name === roleName);
    if (!template) {continue;}

    const pdmPerms = (
      JSON.parse(template.permissions) as Array<{ resource: string; action: string }>
    ).filter((p) => p.resource === PDM_RESOURCE_CODE);
    if (pdmPerms.length === 0) {continue;}

    // Prefer an exact templateId match. Only fall back to name-matching for
    // legacy roles that predate templateId tracking (templateId is null) — this
    // avoids hijacking a custom role that happens to share a template name but
    // is tracked under a different templateId.
    const role =
      existingRoles.find((r) => r.templateId === template.id) ??
      existingRoles.find((r) => !r.templateId && r.name === template.name);
    if (!role) {
      results.push({ roleName, roleId: null, added: [], skippedRevoked: [], applied: apply });
      continue;
    }

    const existingGrants = grantsByRoleId.get(role.id) ?? [];
    const grantRow = (resource: string, action: string) =>
      existingGrants.find((g) => g.resourceCode === resource && g.actionCode === action);

    const added: Array<{ resource: string; action: string }> = [];
    const skippedRevoked: Array<{ resource: string; action: string }> = [];

    for (const perm of pdmPerms) {
      const row = grantRow(perm.resource, perm.action);
      if (!row) {
        added.push({ resource: perm.resource, action: perm.action });
      } else if (!row.isGranted) {
        skippedRevoked.push({ resource: perm.resource, action: perm.action });
      }
    }

    results.push({ roleName, roleId: role.id, added, skippedRevoked, applied: apply });
  }

  return results;
}
