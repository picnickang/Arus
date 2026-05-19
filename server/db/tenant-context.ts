/**
 * Tenant Context — AsyncLocalStorage substrate for pinned per-request RLS.
 *
 * Task #88 (RLS hardening).
 *
 * The Express middleware (`server/middleware/db-context.ts`) checks out a
 * single physical Postgres client per request, runs
 *
 *   BEGIN;
 *   SELECT set_config('app.current_org_id', $orgId, true);   -- LOCAL
 *   <handler runs>
 *   COMMIT / ROLLBACK;
 *
 * and stashes the drizzle-on-client wrapper here in `tenantContextStore`
 * for the duration of the request. The shared `db` Proxy in
 * `server/db-config.ts` reads this store on every property access and
 * routes through `ctx.tx` when present, so existing repositories that
 * import `db` automatically execute their queries against the pinned
 * client — without us having to plumb `req.tx` through every call site.
 *
 * Background workers use the same pattern: `server/background-jobs.ts`
 * wraps each handler invocation in `withTenantContext` keyed on the
 * `orgId` packed into the job payload.
 *
 * IMPORTANT: this module must not import anything from `db-config` —
 * `db-config` imports `tenantContextStore` from here, and a circular
 * import would make the Proxy see `undefined` at boot.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContextStore {
  orgId: string;
  /**
   * Drizzle handle bound to the pinned PoolClient. Same shape as the
   * shared `db` export — `select`, `insert`, `transaction`, etc. — but
   * every statement runs on the held client inside the open transaction.
   * Typed as `unknown` here to keep this file driver-agnostic; the
   * `db-config` Proxy treats it structurally.
   */
  tx: unknown;
}

export const tenantContextStore = new AsyncLocalStorage<TenantContextStore>();

export function getTenantContext(): TenantContextStore | undefined {
  return tenantContextStore.getStore();
}

export function getTenantOrgId(): string | undefined {
  return tenantContextStore.getStore()?.orgId;
}
