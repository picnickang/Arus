/**
 * Database Context Middleware
 * Sets the current organization ID in PostgreSQL for optional RLS policies.
 *
 * SINGLE-TENANT SYSTEM: Always uses default-org-id. This is a defense-in-depth
 * context value, not a substitute for authenticated repository-level filtering.
 *
 * NOTE: This middleware is PostgreSQL-specific and is skipped in SQLite mode
 */

import { Request, Response, NextFunction } from "express";
import { db, isLocalMode } from "../db-config";
import { sql } from "drizzle-orm";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Middleware:DbContext");

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
 * Sets the organization context in the database session for RLS enforcement
 * Must be applied AFTER authentication middleware that sets req.user
 */
export async function setDatabaseContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip RLS in SQLite mode (PostgreSQL-only feature)
    if (isLocalMode) {
      next();
      return;
    }

    // SINGLE-TENANT: Always use default org ID
    const orgId = (req as DbContextRequest).orgId || DEFAULT_ORG_ID;

    if (orgId) {
      // Set the organization ID in the PostgreSQL session
      // This enables Row-Level Security policies to filter by org
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
    // Skip RLS in SQLite mode (PostgreSQL-only feature)
    if (isLocalMode) {
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
  // Skip RLS in SQLite mode (PostgreSQL-only feature)
  if (isLocalMode) {
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
