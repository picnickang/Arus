/**
 * Tenant Configuration
 *
 * Push B1 (Multi-tenancy with Postgres RLS):
 * - The platform is migrating from single-tenant (one hardcoded
 *   `DEFAULT_ORG_ID`) to multi-tenant. Old code paths still import
 *   `DEFAULT_ORG_ID` directly; the new contract is to derive `req.orgId`
 *   from the authenticated user's session claim and refuse anything else.
 *
 * - The cutover is gated by `REQUIRE_TENANT_AUTH=true`. While the flag is
 *   off, requests still fall back to `DEFAULT_ORG_ID` so existing
 *   single-tenant deployments keep working. When the flag is on:
 *     * `requireOrgId` rejects unauthenticated requests with 401.
 *     * Auth middleware sets `req.orgId = req.user.orgId` (no fallback).
 *     * Postgres RLS policies (migration 0018) enforce isolation server-
 *       side so even a missing `WHERE org_id = …` clause returns 0 rows.
 */

export const DEFAULT_ORG_ID = "default-org-id";

export const TENANT_CONFIG = {
  orgId: DEFAULT_ORG_ID,
  slug: "default",
  name: "Default Organization",
} as const;

/**
 * Returns true when the deployment requires every request to carry an
 * authenticated `orgId` claim. Defaults to false so legacy single-tenant
 * deployments keep booting; set `REQUIRE_TENANT_AUTH=true` to flip the
 * platform into SaaS mode.
 */
export function requireTenantAuth(): boolean {
  return process.env.REQUIRE_TENANT_AUTH === "true";
}

/**
 * Resolve the org id to use as a fallback when the caller has no
 * authenticated user. In legacy mode this is `DEFAULT_ORG_ID`. In tenant-
 * auth mode the caller must already have rejected unauthenticated
 * requests, so we throw if this is ever called.
 */
export function fallbackOrgId(): string {
  if (requireTenantAuth()) {
    throw new Error(
      "REQUIRE_TENANT_AUTH=true: no DEFAULT_ORG_ID fallback is permitted. " +
        "Derive orgId from the authenticated session instead."
    );
  }
  return DEFAULT_ORG_ID;
}
