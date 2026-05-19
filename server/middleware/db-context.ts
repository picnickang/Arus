/**
 * Database Context Middleware
 * Sets the current organization ID in PostgreSQL for RLS policies.
 *
 * ⚠️ Push B1 KNOWN LIMITATION — pinned-connection follow-up required.
 *
 * The current implementation calls `set_config('app.current_org_id', x, false)`
 * on the shared `db` handle. This is correct on a *pinned* connection (one
 * physical socket per request) but the shared handle pulls a connection
 * from the pool per `db.execute()`. Two consequences:
 *
 *   1. With node-postgres pool (multi-statement driver): the value can
 *      leak into a different request that happens to land on the same
 *      backend before `RESET` runs. Architect-review flagged this.
 *   2. With neon-http (1-statement driver, the typical Replit setup):
 *      `set_config` is scoped to that single HTTP call; the value is
 *      not visible to the next call, so RLS would silently match no
 *      rows for every request.
 *
 * Neither failure mode is acceptable as the sole isolation boundary,
 * which is why this file historically documented itself as "defense-in-
 * depth only, repository filters are authoritative". Push B1 keeps that
 * contract: repository-level `WHERE org_id = …` remains the primary
 * boundary; RLS is the second line of defense.
 *
 * The proper fix — wrap each request handler in a `BEGIN; SET LOCAL …;
 * <handler>; COMMIT;` against a per-request pinned client and route all
 * `db.*` calls through that client — is tracked as a follow-up task
 * because it touches every domain repository's `db` import. See the
 * Push B1 follow-up issue.
 *
 * For now: this middleware still sets the variable best-effort so that
 * test fixtures and pinned-connection deployments (e.g. running drizzle
 * via a dedicated `Client`, not a `Pool`) benefit immediately, while
 * the multi-tenant data plane continues to rely on the repository-level
 * WHERE clauses already in place.
 *
 * Skipped in SQLite mode.
 */

import { Request, Response, NextFunction } from "express";
import { db, isLocalMode } from "../db-config";
import { sql } from "drizzle-orm";
import { DEFAULT_ORG_ID, requireTenantAuth } from "@shared/config/tenant";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Middleware:DbContext");

// Push B1: when tenant-auth is required the RLS context is mandatory —
// the policies in migration 0018 read `app.current_org_id` and fail
// closed if it's unset. In legacy mode the explicit flag still gates it
// so single-tenant deployments don't pay the per-request SET cost.
const ENABLE_PG_RLS_CONTEXT =
  process.env.ENABLE_PG_RLS_CONTEXT === "true" || requireTenantAuth();

export type DbContextRequest = Request;

/**
 * Optionally sets organization context in the database session.
 * Disabled by default because request safety requires a request-scoped transaction
 * or pinned connection; pooled one-off queries cannot guarantee the context is
 * visible to later repository calls.
 */
export async function setDatabaseContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip unless explicitly enabled. Repository filters are authoritative.
    if (isLocalMode || !ENABLE_PG_RLS_CONTEXT) {
      next();
      return;
    }

    // SINGLE-TENANT: Always use default org ID
    const orgId = (req as DbContextRequest).orgId || DEFAULT_ORG_ID;

    if (orgId) {
      // Set a compatibility organization ID in the PostgreSQL session.
      // This is optional defense-in-depth only, not the authoritative boundary.
      // Note: SET commands don't support parameterized queries, so we use sql.raw.
      // orgId is validated by auth middleware, but we defense-in-depth here: a
      // future regression in auth middleware (or a new code path that bypasses
      // it) would otherwise turn this into SQL injection via set_config. Allow
      // only the safe character class used by all real org IDs in the system.
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(orgId)) {
        logger.warn(`[DB_CONTEXT] Refusing to set malformed orgId for ${req.path}`);
        next();
        return;
      }
      await db.execute(sql.raw(`SELECT set_config('app.current_org_id', '${orgId}', false)`));

      // Log for debugging (remove in production)
      if (process.env.NODE_ENV === "development") {
        logger.info(`[DB_CONTEXT] Set org context: ${orgId} for ${req.path}`);
      }
    }

    next();
  } catch (error) {
    logger.error("[DB_CONTEXT] Error setting database context:", undefined, error);
    // Don't block the request, but log the error
    next();
  }
}

/**
 * Resets the database context after request completion
 * This ensures isolation between requests in connection pooling scenarios
 */
export async function resetDatabaseContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip unless explicitly enabled. Repository filters are authoritative.
    if (isLocalMode || !ENABLE_PG_RLS_CONTEXT) {
      next();
      return;
    }

    // Reset the session variable
    await db.execute(sql.raw(`RESET app.current_org_id`));

    if (process.env.NODE_ENV === "development") {
      logger.info(`[DB_CONTEXT] Reset org context for ${req.path}`);
    }
  } catch (error) {
    logger.error("[DB_CONTEXT] Error resetting database context:", undefined, error);
  }

  next();
}

/**
 * Combined middleware that ensures database context is set and cleaned up
 */
export function withDatabaseContext(req: Request, res: Response, next: NextFunction): void {
  // Skip unless explicitly enabled. Repository filters are authoritative.
  if (isLocalMode || !ENABLE_PG_RLS_CONTEXT) {
    next();
    return;
  }

  // Set context before request
  setDatabaseContext(req, res, () => {
    // Clean up after response
    res.on("finish", async () => {
      try {
        await db.execute(sql.raw(`RESET app.current_org_id`));
      } catch (error) {
        logger.error("[DB_CONTEXT] Error in cleanup:", undefined, error);
      }
    });
    next();
  });
}
