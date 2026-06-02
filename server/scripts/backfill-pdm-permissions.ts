/**
 * Backfill `predictive_maintenance` permission grants for existing orgs.
 *
 * Why this exists
 * ---------------
 * Role templates (server/config/default-role-templates.ts) now grant
 * `predictive_maintenance` view/manage_config/override to the admin-capable
 * roles (super_admin, admin, company_admin, chief_engineer). But
 * `provisionTemplatesForOrg` only ever CREATES missing roles — it never adds
 * grants to roles that already exist. Any org seeded before that template
 * change is left with admins who cannot use PdM lifecycle actions.
 *
 * This script walks every organization and ensures those roles carry the
 * default `predictive_maintenance` grants.
 *
 * Safety
 * ------
 * - Idempotent: only INSERTS grants that have no row at all; re-running is a
 *   no-op once grants are present.
 * - No duplicate rows: writes go through `setPermissionGrant`, which
 *   checks-then-writes.
 * - Respects deliberate revocations: an existing `isGranted=false` row is
 *   reported and LEFT UNTOUCHED, never silently re-enabled.
 * - Scoped: only the `predictive_maintenance` resource and only the four
 *   admin-capable roles — never normal users, never any other resource.
 *
 * Usage
 * -----
 *   npx tsx server/scripts/backfill-pdm-permissions.ts            # dry-run (default)
 *   npx tsx server/scripts/backfill-pdm-permissions.ts --apply    # perform writes
 *
 * After --apply, a running server's in-memory permission cache (5-min TTL)
 * will refresh on its own; affected admins can also re-login to pick up the
 * grants immediately.
 */

import { db } from "../db";
import { organizations } from "../../shared/schema/core";
import {
  backfillPdmTemplateGrantsForOrg,
  type PdmBackfillRoleResult,
} from "../domains/permissions/repository";

const apply = process.argv.includes("--apply");

function summarizeOrg(results: PdmBackfillRoleResult[]): {
  addedCount: number;
  revokedCount: number;
  missingRoles: number;
} {
  let addedCount = 0;
  let revokedCount = 0;
  let missingRoles = 0;
  for (const r of results) {
    if (r.roleId === null) {
      missingRoles += 1;
      continue;
    }
    addedCount += r.added.length;
    revokedCount += r.skippedRevoked.length;
  }
  return { addedCount, revokedCount, missingRoles };
}

async function main(): Promise<void> {
  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations);

  console.log(
    `[backfill-pdm] mode=${apply ? "APPLY" : "DRY-RUN"} | organizations=${orgs.length}`
  );
  console.log(
    apply
      ? "[backfill-pdm] Writing missing predictive_maintenance grants...\n"
      : "[backfill-pdm] No writes will be made. Re-run with --apply to write.\n"
  );

  let totalAdded = 0;
  let totalRevoked = 0;

  for (const org of orgs) {
    const results = await backfillPdmTemplateGrantsForOrg(org.id, { apply });
    const { addedCount, revokedCount, missingRoles } = summarizeOrg(results);
    totalAdded += addedCount;
    totalRevoked += revokedCount;

    if (addedCount === 0 && revokedCount === 0 && missingRoles === 0) {
      console.log(`  ✓ ${org.name ?? org.id}: already up to date`);
      continue;
    }

    console.log(`  • ${org.name ?? org.id}:`);
    for (const r of results) {
      if (r.roleId === null) {
        console.log(`      - role "${r.roleName}" not present (skipped)`);
        continue;
      }
      if (r.added.length > 0) {
        const actions = r.added.map((g) => g.action).join(", ");
        console.log(
          `      - role "${r.roleName}": ${apply ? "granted" : "would grant"} predictive_maintenance:[${actions}]`
        );
      }
      if (r.skippedRevoked.length > 0) {
        const actions = r.skippedRevoked.map((g) => g.action).join(", ");
        console.log(
          `      - role "${r.roleName}": left explicitly-revoked predictive_maintenance:[${actions}] untouched`
        );
      }
    }
  }

  console.log(
    `\n[backfill-pdm] Done. ${apply ? "Granted" : "Would grant"} ${totalAdded} grant(s); left ${totalRevoked} revoked grant(s) untouched.`
  );
  process.exit(0);
}

const invokedDirectly = (() => {
  try {
    const entry = process.argv[1] ?? "";
    return entry.endsWith("backfill-pdm-permissions.ts") || entry.endsWith("backfill-pdm-permissions.js");
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((error) => {
    console.error("[backfill-pdm] Error:", error);
    process.exit(1);
  });
}
