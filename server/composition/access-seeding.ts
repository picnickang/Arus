/**
 * Composition root for Access & Permissions seeding.
 *
 * Lives outside `server/domains/` on purpose: it wires the permissions domain
 * (role provisioning) to the crew table (RBAC role backfill) and applies the
 * curated hub-access defaults for the consolidated "Access & Permissions" page.
 *
 * Everything here is IDEMPOTENT and safe to run on every boot in every
 * environment (dev AND prod) — it only fills in gaps, never overwrites an
 * explicit operator choice. Pairs with migration 0034, which sets the same
 * admin hub_access default + super-admin bootstrap at the SQL layer; this layer
 * additionally creates any missing template roles and the per-role hub_admin
 * flag the SQL migration cannot derive.
 */

import {
  provisionTemplatesForOrg,
  listOrgRolesForSeeding,
  setRoleHubDefaults,
  listUnlinkedCrewForSeeding,
  setCrewRoleId,
  listDistinctRoleOrgIds,
} from "../domains/permissions/repository";
import {
  SUPER_ADMIN_ROLE_KEYS,
  DEFAULT_RANK_TO_ACCESS_LEVEL,
  normalizeRankKey,
  defaultAccessLevelForRank,
} from "@shared/role-dashboard";
import { createLogger } from "../lib/structured-logger";
import { isLocalMode } from "../config/runtimeEnv";

const logger = createLogger("Composition:AccessSeeding");

/** Curated default hub allow-list for the regular (non-super) admin role. */
const ADMIN_DEFAULT_HUB_ACCESS = ["system", "operations"] as const;

/**
 * Ensure the curated access-level roles exist and carry sensible hub defaults,
 * then backfill any crew rows that have no RBAC role yet from their rank.
 * Returns a small summary for logging/observability. Never throws — seeding
 * failures must not crash boot.
 */
export async function seedAccessAndDashboards(orgId: string): Promise<{
  rolesProvisioned: number;
  hubDefaultsApplied: number;
  crewBackfilled: number;
}> {
  const summary = { rolesProvisioned: 0, hubDefaultsApplied: 0, crewBackfilled: 0 };

  // 1. Make sure every curated role row exists (admin, super_admin, manager,
  //    crew_member/viewer, plus the maritime templates). Idempotent: only
  //    missing roles are created.
  const provisioned = await provisionTemplatesForOrg(orgId);
  summary.rolesProvisioned = provisioned.length;

  // 2. Apply hub defaults. Super tier → full hubs (hubAdmin, hubAccess NULL).
  //    Regular admin → admin hub + a sensible working set, but ONLY when it has
  //    not been configured yet (hubAdmin still false), so we never clobber an
  //    operator's narrower/wider choice.
  const orgRoles = await listOrgRolesForSeeding(orgId);

  const superKeys = new Set<string>(SUPER_ADMIN_ROLE_KEYS as readonly string[]);

  for (const role of orgRoles) {
    const key = role.name.trim().toLowerCase();
    if (superKeys.has(key)) {
      if (!role.hubAdmin || role.hubAccess !== null) {
        await setRoleHubDefaults(orgId, role.id, { hubAdmin: true, hubAccess: null });
        summary.hubDefaultsApplied += 1;
      }
    } else if (key === "admin") {
      if (!role.hubAdmin) {
        await setRoleHubDefaults(orgId, role.id, {
          hubAdmin: true,
          hubAccess: [...ADMIN_DEFAULT_HUB_ACCESS],
        });
        summary.hubDefaultsApplied += 1;
      }
    }
  }

  // 3. Backfill crew.roleId from rank for rows that have no RBAC role yet.
  //    Map rank → access level → the org role row with that name.
  const roleIdByName = new Map<string, string>();
  for (const role of orgRoles) {
    roleIdByName.set(role.name.trim().toLowerCase(), role.id);
  }

  const unlinked = await listUnlinkedCrewForSeeding(orgId);

  for (const member of unlinked) {
    const accessLevel = defaultAccessLevelForRank(member.rank, DEFAULT_RANK_TO_ACCESS_LEVEL);
    // Prefer a direct rank→role name match first (e.g. rank "chief_engineer"
    // maps to a real RBAC role of the same name), then fall back to the curated
    // access level row.
    const rankKey = normalizeRankKey(member.rank);
    const targetRoleId = roleIdByName.get(rankKey) ?? roleIdByName.get(accessLevel);
    if (!targetRoleId) {
      continue;
    }
    await setCrewRoleId(orgId, member.id, targetRoleId);
    summary.crewBackfilled += 1;
  }

  return summary;
}

/**
 * Boot entry point. Seeds every org that currently has crew or roles, so the
 * consolidated access model is consistent on first load in dev and prod.
 * Swallows errors per-org so one bad org never blocks boot.
 */
export async function seedAccessForAllOrgs(): Promise<void> {
  if (isLocalMode) {
    logger.info("Access seeding skipped in local SQLite mode; role tables are cloud runtime tables");
    return;
  }

  try {
    const orgIds = new Set<string>(await listDistinctRoleOrgIds());
    // Always include the default org even if it has no roles yet.
    orgIds.add("default-org-id");

    for (const orgId of orgIds) {
      try {
        const summary = await seedAccessAndDashboards(orgId);
        logger.info("Access seeding complete", { orgId, ...summary });
      } catch (err) {
        logger.warn("Access seeding failed for org (non-fatal)", {
          orgId,
          details: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    logger.warn("Access seeding skipped (non-fatal)", {
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
