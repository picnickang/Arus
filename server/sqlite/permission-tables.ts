/**
 * SQLite Permission Tables
 *
 * Embedded/vessel mode still executes the canonical permission service for
 * backend authorization. These tables mirror the deployed permission contract
 * closely enough for deterministic local runtime checks.
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getPermissionTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, display_name TEXT NOT NULL, description TEXT, department TEXT, hierarchy_level INTEGER NOT NULL DEFAULT 50, parent_role_id TEXT, template_id TEXT, permissions TEXT, is_system_role INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, hub_admin INTEGER NOT NULL DEFAULT 0, hub_access TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS permission_grants (id TEXT PRIMARY KEY, role_id TEXT NOT NULL, resource_code TEXT NOT NULL, action_code TEXT NOT NULL, is_granted INTEGER DEFAULT 1, "condition" TEXT, created_at INTEGER, created_by TEXT)`,
    sql`CREATE TABLE IF NOT EXISTS user_role_assignments (id TEXT PRIMARY KEY, org_id TEXT, user_id TEXT NOT NULL, role_id TEXT NOT NULL, assigned_by TEXT, is_active INTEGER DEFAULT 1)`,
  ];
}

export function getPermissionIndexesSql(): SQL[] {
  return [
    sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_org_name ON roles(org_id, name)`,
    sql`CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_roles_hierarchy ON roles(org_id, hierarchy_level)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_permission_grants ON permission_grants(role_id, resource_code, action_code)`,
    sql`CREATE INDEX IF NOT EXISTS idx_permission_grants_role ON permission_grants(role_id)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role ON user_role_assignments(org_id, user_id, role_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role ON user_role_assignments(role_id)`,
  ];
}
