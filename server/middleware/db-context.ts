// @ts-nocheck
/**
 * Database Context Middleware
 * Optionally sets the current organization ID in PostgreSQL for compatibility RLS policies.
 *
 * SINGLE-TENANT SYSTEM: Always uses default-org-id. This is a defense-in-depth
 * context value only; repository-level filtering remains the authoritative boundary.
 *
 * NOTE: This middleware is PostgreSQL-specific and is skipped in SQLite mode
 */

import { Request, Response, NextFunction } from "express";
import { db, isLocalMode } from "../db-config";
import { sql } from "drizzle-orm";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Middleware:DbContext");

const ENABLE_PG_RLS_CONTEXT = process.env.ENABLE_PG_RLS_CONTEXT === "true";

export interface DbContextRequest extends Request {
  orgId?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
    isActive: boolean;
  };
}

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
