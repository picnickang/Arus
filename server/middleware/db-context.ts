/**
 * Database Context Middleware — pinned per-request RLS (Task #88).
 *
 * Every authenticated `/api/*` request is wrapped in a per-request
 * Postgres transaction against a single physical pool client:
 *
 *     BEGIN;
 *     SELECT set_config('app.current_org_id', $orgId, true);  -- LOCAL
 *     <route handler runs here>
 *     COMMIT  (on 2xx/3xx/4xx)
 *     ROLLBACK (on 5xx or uncaught exception)
 *
 * The pinned drizzle handle is stashed in `tenantContextStore`
 * (`server/db/tenant-context.ts`) and the shared `db` Proxy in
 * `server/db-config.ts` routes through it for the rest of the request,
 * so existing repositories don't need plumbing changes — every
 * `db.select(...)` they make lands on the held client inside the open
 * transaction, and the in-flight `SET LOCAL` applies.
 *
 * Why this replaces the old shared-handle `set_config` path:
 *   - On `neon-http` (single-statement driver) the value evaporated after
 *     the call that ran it; RLS matched zero rows for every subsequent
 *     query. The boot gate in `db-config.ts` now refuses to start
 *     `REQUIRE_TENANT_AUTH=true` on non-pooled drivers.
 *   - On `node-postgres Pool` / `neon-serverless` the value could leak
 *     into whatever request next checked out the same backend before
 *     `RESET` ran. Now the value is `LOCAL` to the request's transaction
 *     and disappears automatically on COMMIT/ROLLBACK.
 *
 * Repository-layer `WHERE org_id = …` filters are kept as defense-in-
 * depth — a single bug in this wrapper would otherwise open a
 * cross-tenant hole — but RLS is now the authoritative boundary.
 *
 * Skipped in SQLite (vessel) mode where there's only one tenant.
 */

import type { Request, Response, NextFunction } from "express";
import type { PoolClient } from "pg";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeonWs } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema-runtime";
import {
  isLocalMode,
  pool as sharedPool,
  connectionMode,
  supportsPinnedConnection,
} from "../db-config";
import { DEFAULT_ORG_ID, requireTenantAuth } from "@shared/config/tenant";
import { tenantContextStore } from "../db/tenant-context";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Middleware:DbContext");

// Push B1 / Task #88: in REQUIRE_TENANT_AUTH mode the pinned context is
// mandatory (RLS is the authoritative boundary). In legacy mode an
// explicit flag opts in so single-tenant deployments don't pay the
// per-request transaction cost.
const ENABLE_PG_RLS_CONTEXT =
  process.env['ENABLE_PG_RLS_CONTEXT'] === "true" || requireTenantAuth();

const ORG_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type DbContextRequest = Request & { orgId?: string };

function buildClientDrizzle(client: PoolClient): unknown {
  // node-postgres and neon-serverless both accept a PoolClient and
  // return a drizzle handle with the same query-builder shape as the
  // shared pool-backed instance. The Proxy in db-config.ts treats it
  // structurally so either driver works here.
  if (connectionMode === "websocket") {
    // neon-serverless WS driver expects its own PoolClient type; the
    // shape is identical at runtime to pg.PoolClient for our use.
    return drizzleNeonWs(client as never, { schema });
  }
  return drizzleNodePg(client, { schema });
}

/**
 * Combined middleware that opens a pinned-client transaction, sets
 * `app.current_org_id` LOCAL to it, runs the rest of the request inside
 * the `tenantContextStore`, and commits/rolls back on response finish.
 *
 * Fail-closed: in `REQUIRE_TENANT_AUTH=true` mode a missing or malformed
 * `req.orgId` rejects the request with `401 TENANT_CONTEXT_MISSING`
 * instead of silently falling back to `DEFAULT_ORG_ID`.
 */
export function withDatabaseContext(req: Request, res: Response, next: NextFunction): void {
  if (isLocalMode || !ENABLE_PG_RLS_CONTEXT) {
    next();
    return;
  }

  const tenantAuth = requireTenantAuth();
  const claim = (req as DbContextRequest).orgId;

  if (tenantAuth) {
    if (!claim || !ORG_ID_PATTERN.test(claim)) {
      res.status(401).json({
        message: "Tenant context required",
        code: "TENANT_CONTEXT_MISSING",
      });
      return;
    }
  } else {
    // Legacy single-tenant fallback. Still validate the shape so we
    // never interpolate junk into SET LOCAL.
    const legacyId = claim ?? DEFAULT_ORG_ID;
    if (!ORG_ID_PATTERN.test(legacyId)) {
      logger.warn(`[DB_CONTEXT] Refusing malformed orgId for ${req.path}`);
      next();
      return;
    }
    (req as DbContextRequest).orgId = legacyId;
  }

  const orgId = (req as DbContextRequest).orgId as string;

  if (!sharedPool || !supportsPinnedConnection) {
    // Boot gate in db-config.ts already refused to start in this
    // configuration when REQUIRE_TENANT_AUTH=true, so reaching here
    // means legacy mode on an http driver — RLS is best-effort only.
    // Skip silently rather than failing the request: repository-level
    // WHERE filters remain authoritative in that mode.
    logger.warn(
      `[DB_CONTEXT] Pinned context unavailable (driver=${connectionMode}); skipping for ${req.path}`,
    );
    next();
    return;
  }

  void (async () => {
    let client: PoolClient;
    try {
      client = (await (sharedPool as { connect(): Promise<PoolClient> }).connect()) as PoolClient;
    } catch (err) {
      logger.error("[DB_CONTEXT] Failed to acquire pool client", undefined, err);
      res.status(503).json({ message: "Database unavailable", code: "DB_UNAVAILABLE" });
      return;
    }

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      try {
        client.release();
      } catch (err) {
        logger.warn(
          `[DB_CONTEXT] client.release() failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };

    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgId]);
    } catch (err) {
      logger.error("[DB_CONTEXT] Failed to open tenant tx", undefined, err);
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      release();
      res.status(503).json({ message: "Database unavailable", code: "DB_UNAVAILABLE" });
      return;
    }

    let tx: unknown;
    try {
      tx = buildClientDrizzle(client);
    } catch (err) {
      logger.error("[DB_CONTEXT] Failed to build drizzle wrapper", undefined, err);
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      release();
      res.status(503).json({ message: "Database unavailable", code: "DB_UNAVAILABLE" });
      return;
    }

    let finalized = false;
    const finalize = async () => {
      if (finalized) return;
      finalized = true;
      try {
        // 5xx and aborted-mid-flight requests roll back so partial
        // writes are not committed. 4xx are user errors with already-
        // shaped responses — keep their writes (most are no-ops anyway).
        const aborted = !res.writableEnded;
        if (aborted || res.statusCode >= 500) {
          await client.query("ROLLBACK");
        } else {
          await client.query("COMMIT");
        }
      } catch (err) {
        logger.warn(
          `[DB_CONTEXT] tx finalize failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        release();
      }
    };

    res.on("finish", () => {
      void finalize();
    });
    res.on("close", () => {
      void finalize();
    });

    tenantContextStore.run({ orgId, tx }, () => {
      next();
    });
  })();
}

/**
 * Back-compat exports — older modules import these by name. The pinned
 * `withDatabaseContext` does everything in one wrapper now, so these
 * are kept as no-op shims to avoid an import storm.
 */
export async function setDatabaseContext(
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  next();
}

export async function resetDatabaseContext(
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  next();
}

/**
 * Programmatic entry point used by background workers
 * (`server/background-jobs.ts`) and ad-hoc admin scripts that need to
 * run a block under a pinned tenant context outside the Express request
 * lifecycle. Opens its own pinned transaction, runs `fn` inside the
 * `tenantContextStore`, and commits on success / rolls back on throw.
 *
 * Returns whatever `fn` returns. Throws if no pool is available or the
 * driver does not support pinned connections.
 */
export async function withTenantContext<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  if (isLocalMode) {
    // No RLS in SQLite vessel mode — just run.
    return fn();
  }
  if (!ORG_ID_PATTERN.test(orgId)) {
    throw new Error(`withTenantContext: malformed orgId "${orgId}"`);
  }
  if (!sharedPool || !supportsPinnedConnection) {
    throw new Error(
      `withTenantContext requires a pooled Postgres driver (current: ${connectionMode})`,
    );
  }

  const client = (await (sharedPool as { connect(): Promise<PoolClient> }).connect()) as PoolClient;
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgId]);
    const tx = buildClientDrizzle(client);
    try {
      const result = await tenantContextStore.run({ orgId, tx }, fn);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    }
  } finally {
    try {
      client.release();
    } catch {
      /* ignore */
    }
  }
}
