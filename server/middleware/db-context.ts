/**
 * Database Context Middleware for Row-Level Security
 * Sets the current organization ID in the database session
 * 
 * SINGLE-TENANT SYSTEM: Always uses default-org-id
 * 
 * NOTE: This middleware is PostgreSQL-specific and is skipped in SQLite mode
 */

import { Request, Response, NextFunction } from "express";
import { db, isLocalMode } from "../db-config";
import { sql } from "drizzle-orm";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

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
      // Note: SET commands don't support parameterized queries, so we use sql.raw
      // orgId is validated by auth middleware, so this is safe
      await db.execute(sql.raw(`SET LOCAL app.current_org_id = '${orgId}'`));

      // Log for debugging (remove in production)
      if (process.env.NODE_ENV === "development") {
        console.log(`[DB_CONTEXT] Set org context: ${orgId} for ${req.path}`);
      }
    }

    next();
  } catch (error) {
    console.error("[DB_CONTEXT] Error setting database context:", error);
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
      console.log(`[DB_CONTEXT] Reset org context for ${req.path}`);
    }
  } catch (error) {
    console.error("[DB_CONTEXT] Error resetting database context:", error);
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
        console.error("[DB_CONTEXT] Error in cleanup:", error);
      }
    });
    next();
  });
}
