import type { Client } from "@libsql/client";
import { createLogger } from "../lib/structured-logger";
import { getTableColumns, safeAddColumn } from "./compatibility-migrations.js";

const logger = createLogger("SqliteInit:Compatibility");
type LibsqlClient = Client;

export async function runEquipmentCompatibilityMigration(client: LibsqlClient): Promise<void> {
  const cols = await getTableColumns(client, "equipment");
  if (!cols.length) {
    return;
  }

  const expectedColumns: Array<[string, string]> = [
    ["plain_language_name", "TEXT"],
    ["system_type", "TEXT"],
    ["component_type", "TEXT"],
    ["criticality_level", "TEXT DEFAULT 'medium'"],
    ["emergency_labor_multiplier", "REAL"],
    ["emergency_parts_multiplier", "REAL"],
    ["emergency_downtime_multiplier", "REAL"],
    ["downtime_cost_per_hour", "REAL"],
    ["default_service_provider_id", "TEXT"],
    ["purchase_value", "REAL"],
    ["purchase_date", "INTEGER"],
    ["purchase_currency", "TEXT DEFAULT 'USD'"],
    ["service_life_hours", "REAL"],
    ["service_life_years", "REAL"],
    ["depreciation_method", "TEXT DEFAULT 'straight_line'"],
    ["depreciation_rate", "REAL"],
    ["salvage_value", "REAL"],
    ["decommissioned_at", "INTEGER"],
    ["decommissioned_by", "TEXT"],
    ["decommission_status", "TEXT DEFAULT 'active'"],
    ["decommission_event_id", "TEXT"],
    ["reinstated_at", "INTEGER"],
    ["reinstated_by", "TEXT"],
    ["parent_equipment_id", "TEXT"],
    ["hierarchy_level", "INTEGER DEFAULT 0"],
    ["hierarchy_path", "TEXT DEFAULT ''"],
  ];

  for (const [col, definition] of expectedColumns) {
    if (!cols.includes(col)) {
      await safeAddColumn(client, "equipment", col, definition);
    }
  }

  logger.info("✓ Equipment compatibility migration completed");
}

export async function runPermissionCompatibilityMigration(client: LibsqlClient): Promise<void> {
  const roleCols = await getTableColumns(client, "roles");
  if (roleCols.length) {
    const expectedRoleColumns: Array<[string, string]> = [
      ["org_id", "TEXT NOT NULL DEFAULT 'default-org-id'"],
      ["name", "TEXT NOT NULL DEFAULT ''"],
      ["display_name", "TEXT NOT NULL DEFAULT ''"],
      ["description", "TEXT"],
      ["department", "TEXT"],
      ["hierarchy_level", "INTEGER NOT NULL DEFAULT 50"],
      ["parent_role_id", "TEXT"],
      ["template_id", "TEXT"],
      ["permissions", "TEXT"],
      ["is_system_role", "INTEGER DEFAULT 0"],
      ["is_active", "INTEGER DEFAULT 1"],
      ["hub_admin", "INTEGER NOT NULL DEFAULT 0"],
      ["hub_access", "TEXT"],
      ["created_at", "INTEGER"],
      ["updated_at", "INTEGER"],
    ];
    for (const [col, definition] of expectedRoleColumns) {
      if (!roleCols.includes(col)) {
        await safeAddColumn(client, "roles", col, definition);
      }
    }
  }

  const grantCols = await getTableColumns(client, "permission_grants");
  if (grantCols.length) {
    const expectedGrantColumns: Array<[string, string]> = [
      ["role_id", "TEXT NOT NULL DEFAULT ''"],
      ["resource_code", "TEXT NOT NULL DEFAULT ''"],
      ["action_code", "TEXT NOT NULL DEFAULT ''"],
      ["is_granted", "INTEGER DEFAULT 1"],
      ["condition", "TEXT"],
      ["created_at", "INTEGER"],
      ["created_by", "TEXT"],
    ];
    for (const [col, definition] of expectedGrantColumns) {
      if (!grantCols.includes(col)) {
        await safeAddColumn(client, "permission_grants", col, definition);
      }
    }
  }

  const assignmentCols = await getTableColumns(client, "user_role_assignments");
  if (assignmentCols.length) {
    const expectedAssignmentColumns: Array<[string, string]> = [
      ["org_id", "TEXT"],
      ["user_id", "TEXT NOT NULL DEFAULT ''"],
      ["role_id", "TEXT NOT NULL DEFAULT ''"],
      ["assigned_by", "TEXT"],
      ["is_active", "INTEGER DEFAULT 1"],
    ];
    for (const [col, definition] of expectedAssignmentColumns) {
      if (!assignmentCols.includes(col)) {
        await safeAddColumn(client, "user_role_assignments", col, definition);
      }
    }
  }

  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_org_name ON roles(org_id, name)`
  );
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_permission_grants ON permission_grants(role_id, resource_code, action_code)`
  );
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role ON user_role_assignments(org_id, user_id, role_id)`
  );
  logger.info("✓ Permission compatibility migration completed");
}

export async function runImportManifestCompatibilityMigration(client: LibsqlClient): Promise<void> {
  const cols = await getTableColumns(client, "import_manifest");
  if (!cols.length) {
    return;
  }

  if (!cols.includes("created_at")) {
    await safeAddColumn(client, "import_manifest", "created_at", "INTEGER");
  }
  if (!cols.includes("updated_at")) {
    await safeAddColumn(client, "import_manifest", "updated_at", "INTEGER");
  }

  logger.info("✓ Import manifest compatibility migration completed");
}
