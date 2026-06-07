/**
 * Permission Middleware - Route-level Authorization (Re-export)
 *
 * This module now re-exports from server/lib/permissions-middleware.ts
 * to allow domain route files to import without violating domain boundaries.
 *
 * All implementations have been moved to shared infrastructure.
 */

export { requirePermission, requireAnyPermission, requireAllPermissions, attachUserPermissions } from "../../lib/permissions-middleware";
