import type { Client as LibsqlClient } from "@libsql/client";
import { getAllIndexesSql, getAllTablesSql } from "../sqlite/index.js";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("SqliteInit:Compatibility");

export async function getTableColumns(client: LibsqlClient, tableName: string): Promise<string[]> {
  const result = await client.execute(`PRAGMA table_info(${tableName})`);
  return result.rows.map((r) => String(r["name"]));
}

export async function safeRenameColumn(
  client: LibsqlClient,
  table: string,
  oldCol: string,
  newCol: string
): Promise<void> {
  await client.execute(`ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}`);
  logger.info(`  ✓ Renamed ${table}.${oldCol} → ${newCol}`);
}

export async function backfillFromLegacy(
  client: LibsqlClient,
  table: string,
  oldCol: string,
  newCol: string
): Promise<void> {
  const result = await client.execute(
    `UPDATE ${table} SET ${newCol} = ${oldCol} WHERE ${newCol} IS NULL OR ${newCol} = '' OR ${newCol} = 0`
  );
  const count = result.rowsAffected;
  if (count > 0) {
    logger.info(`  ✓ Backfilled ${count} rows: ${table}.${oldCol} → ${newCol}`);
  }
}

export async function safeAddColumn(
  client: LibsqlClient,
  table: string,
  col: string,
  definition: string
): Promise<void> {
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`);
    logger.info(`  ✓ Added ${table}.${col}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate column")) {
      return;
    }
    throw error;
  }
}

export async function ensureDeclaredTablesAndIndexes(): Promise<void> {
  const { db } = await import("../db-config.js");
  const runner = db as object as { run: (s: unknown) => Promise<unknown> };
  for (const stmt of getAllTablesSql()) {
    await runner.run(stmt);
  }
  for (const stmt of getAllIndexesSql()) {
    await runner.run(stmt);
  }
}

export async function runAdminSettingsCompatibilityMigration(client: LibsqlClient): Promise<void> {
  const cols = await getTableColumns(client, "admin_system_settings");
  if (!cols.length) {
    return;
  }

  if (!cols.includes("org_id")) {
    await safeAddColumn(
      client,
      "admin_system_settings",
      "org_id",
      "TEXT NOT NULL DEFAULT 'default-org-id'"
    );
  }
  if (!cols.includes("category")) {
    await safeAddColumn(
      client,
      "admin_system_settings",
      "category",
      "TEXT NOT NULL DEFAULT 'general'"
    );
  }
  if (!cols.includes("key")) {
    await safeAddColumn(client, "admin_system_settings", '"key"', "TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.includes("value")) {
    await safeAddColumn(client, "admin_system_settings", "value", "TEXT");
  }
  if (!cols.includes("data_type")) {
    await safeAddColumn(
      client,
      "admin_system_settings",
      "data_type",
      "TEXT NOT NULL DEFAULT 'string'"
    );
  }
  if (!cols.includes("is_secret")) {
    await safeAddColumn(client, "admin_system_settings", "is_secret", "INTEGER DEFAULT 0");
  }
  if (!cols.includes("is_readonly")) {
    await safeAddColumn(client, "admin_system_settings", "is_readonly", "INTEGER DEFAULT 0");
  }
  if (!cols.includes("validation_rule")) {
    await safeAddColumn(client, "admin_system_settings", "validation_rule", "TEXT");
  }
  if (!cols.includes("default_value")) {
    await safeAddColumn(client, "admin_system_settings", "default_value", "TEXT");
  }
  if (!cols.includes("updated_by")) {
    await safeAddColumn(client, "admin_system_settings", "updated_by", "TEXT");
  }

  const refreshedCols = await getTableColumns(client, "admin_system_settings");
  if (refreshedCols.includes("setting_key") && refreshedCols.includes("key")) {
    await client.execute(
      `UPDATE admin_system_settings SET "key" = setting_key WHERE ("key" IS NULL OR "key" = '') AND setting_key IS NOT NULL`
    );
  }
  if (refreshedCols.includes("setting_value") && refreshedCols.includes("value")) {
    await client.execute(
      `UPDATE admin_system_settings SET value = setting_value WHERE value IS NULL AND setting_value IS NOT NULL`
    );
  }
  if (refreshedCols.includes("setting_type") && refreshedCols.includes("data_type")) {
    await client.execute(
      `UPDATE admin_system_settings SET data_type = setting_type WHERE (data_type IS NULL OR data_type = 'string') AND setting_type IS NOT NULL`
    );
  }
  if (refreshedCols.includes("is_sensitive") && refreshedCols.includes("is_secret")) {
    await client.execute(
      `UPDATE admin_system_settings SET is_secret = is_sensitive WHERE is_sensitive IS NOT NULL`
    );
  }

  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ass_org_category_key_unique ON admin_system_settings(org_id, category, "key")`
  );
  logger.info("✓ Admin system settings compatibility migration completed");
}

export async function runSystemSettingsCompatibilityMigration(client: LibsqlClient): Promise<void> {
  const cols = await getTableColumns(client, "system_settings");
  if (!cols.length) {
    return;
  }

  if (!cols.includes("hmac_required")) {
    await safeAddColumn(client, "system_settings", "hmac_required", "INTEGER DEFAULT 0");
  }
  if (!cols.includes("max_payload_bytes")) {
    await safeAddColumn(client, "system_settings", "max_payload_bytes", "INTEGER DEFAULT 2097152");
  }
  if (!cols.includes("strict_units")) {
    await safeAddColumn(client, "system_settings", "strict_units", "INTEGER DEFAULT 0");
  }
  if (!cols.includes("llm_enabled")) {
    await safeAddColumn(client, "system_settings", "llm_enabled", "INTEGER DEFAULT 1");
  }
  if (!cols.includes("llm_model")) {
    await safeAddColumn(client, "system_settings", "llm_model", "TEXT DEFAULT 'gpt-4o-mini'");
  }
  if (!cols.includes("openai_api_key")) {
    await safeAddColumn(client, "system_settings", "openai_api_key", "TEXT");
  }
  if (!cols.includes("ai_insights_throttle_minutes")) {
    await safeAddColumn(
      client,
      "system_settings",
      "ai_insights_throttle_minutes",
      "INTEGER DEFAULT 2"
    );
  }
  if (!cols.includes("timestamp_tolerance_minutes")) {
    await safeAddColumn(
      client,
      "system_settings",
      "timestamp_tolerance_minutes",
      "INTEGER DEFAULT 5"
    );
  }

  await client.execute(
    `INSERT OR IGNORE INTO system_settings (id, hmac_required, max_payload_bytes, strict_units, llm_enabled, llm_model, ai_insights_throttle_minutes, timestamp_tolerance_minutes, org_id, setting_key, setting_type) VALUES ('system', 0, 2097152, 0, 1, 'gpt-4o-mini', 2, 5, 'default-org-id', 'system', 'string')`
  );
  logger.info("✓ System settings compatibility migration completed");
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
