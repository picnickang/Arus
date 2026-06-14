/**
 * SQLite compatibility migrations (continued).
 *
 * Split out of compatibility-migrations.ts to keep each file under the
 * long-file ceiling. Shares the helpers (getTableColumns, safeAddColumn)
 * exported from the sibling module.
 */
import type { Client as LibsqlClient } from "@libsql/client";
import { createLogger } from "../lib/structured-logger";
import { getTableColumns, safeAddColumn } from "./compatibility-migrations.js";

const logger = createLogger("SqliteInit:Compatibility");
export async function runImmutableAuditTrailCompatibilityMigration(
  client: LibsqlClient
): Promise<void> {
  const cols = await getTableColumns(client, "immutable_audit_trail");
  if (!cols.length) {
    return;
  }

  const expectedColumns: Array<[string, string]> = [
    ["event_category", "TEXT"],
    ["event_type", "TEXT"],
    ["previous_state", "TEXT"],
    ["new_state", "TEXT"],
    ["changed_fields", "TEXT"],
    ["performed_by", "TEXT"],
    ["performed_by_type", "TEXT DEFAULT 'user'"],
    ["performed_by_name", "TEXT"],
    ["performed_by_role", "TEXT"],
    ["ip_address", "TEXT"],
    ["device_id", "TEXT"],
    ["vessel_id", "TEXT"],
    ["event_timestamp", "TEXT"],
    ["server_timestamp", "TEXT"],
    ["prev_hash", "TEXT"],
    ["hash", "TEXT NOT NULL DEFAULT ''"],
    ["hash_version", "INTEGER NOT NULL DEFAULT 2"],
    ["compliance_standard", "TEXT"],
    ["retention_required", "INTEGER DEFAULT 1"],
    ["retention_expires_at", "TEXT"],
    ["metadata", "TEXT"],
    ["action", "TEXT NOT NULL DEFAULT ''"],
    ["actor", "TEXT"],
    ["actor_role", "TEXT"],
    ["data_before", "TEXT"],
    ["data_after", "TEXT"],
    ["data_hash", "TEXT NOT NULL DEFAULT ''"],
    ["previous_hash", "TEXT"],
    ["sequence_number", "INTEGER NOT NULL DEFAULT 0"],
    ["created_at", "INTEGER NOT NULL DEFAULT 0"],
  ];

  for (const [col, definition] of expectedColumns) {
    if (!cols.includes(col)) {
      await safeAddColumn(client, "immutable_audit_trail", col, definition);
    }
  }

  const refreshedCols = await getTableColumns(client, "immutable_audit_trail");
  if (refreshedCols.includes("hash") && refreshedCols.includes("data_hash")) {
    await client.execute(
      `UPDATE immutable_audit_trail SET data_hash = hash WHERE (data_hash IS NULL OR data_hash = '') AND hash IS NOT NULL`
    );
  }
  if (refreshedCols.includes("previous_hash") && refreshedCols.includes("prev_hash")) {
    await client.execute(
      `UPDATE immutable_audit_trail SET prev_hash = previous_hash WHERE prev_hash IS NULL AND previous_hash IS NOT NULL`
    );
  }
  if (refreshedCols.includes("performed_by") && refreshedCols.includes("actor")) {
    await client.execute(
      `UPDATE immutable_audit_trail SET performed_by = actor WHERE performed_by IS NULL AND actor IS NOT NULL`
    );
  }
  if (refreshedCols.includes("performed_by_role") && refreshedCols.includes("actor_role")) {
    await client.execute(
      `UPDATE immutable_audit_trail SET performed_by_role = actor_role WHERE performed_by_role IS NULL AND actor_role IS NOT NULL`
    );
  }
  if (refreshedCols.includes("event_timestamp") && refreshedCols.includes("created_at")) {
    await client.execute(
      `UPDATE immutable_audit_trail SET event_timestamp = created_at WHERE event_timestamp IS NULL AND created_at IS NOT NULL AND created_at != 0`
    );
  }
  if (refreshedCols.includes("server_timestamp") && refreshedCols.includes("created_at")) {
    await client.execute(
      `UPDATE immutable_audit_trail SET server_timestamp = created_at WHERE server_timestamp IS NULL AND created_at IS NOT NULL AND created_at != 0`
    );
  }

  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_immutable_audit_trail_event_timestamp ON immutable_audit_trail(event_timestamp)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_immutable_audit_trail_org_event ON immutable_audit_trail(org_id, event_timestamp)`
  );
  logger.info("✓ Immutable audit trail compatibility migration completed");
}

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

export async function runVesselsCompatibilityMigration(client: LibsqlClient): Promise<void> {
  const cols = await getTableColumns(client, "vessels");
  if (!cols.length) {
    return;
  }

  // schematic_layout (JSON mirror of PG's jsonb schematic_layout) was added
  // to the vessels schema but never to the hand-written bootstrap DDL, so
  // embedded DBs created before this fix lack the column and every vessel
  // insert fails ("no column named schematic_layout"). Add it to existing DBs.
  const expectedColumns: Array<[string, string]> = [["schematic_layout", "TEXT"]];

  for (const [col, definition] of expectedColumns) {
    if (!cols.includes(col)) {
      await safeAddColumn(client, "vessels", col, definition);
    }
  }

  logger.info("✓ Vessels compatibility migration completed");
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
