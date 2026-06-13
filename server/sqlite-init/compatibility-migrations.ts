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
  if (!cols.includes("openai_api_key_encrypted")) {
    await safeAddColumn(client, "system_settings", "openai_api_key_encrypted", "TEXT");
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

export async function runUsersAuthCompatibilityMigration(client: LibsqlClient): Promise<void> {
  const cols = await getTableColumns(client, "users");
  if (!cols.length) {
    return;
  }

  const expectedColumns: Array<[string, string]> = [
    ["username", "TEXT"],
    ["password_hash", "TEXT"],
    ["password_updated_at", "INTEGER"],
    ["job_title", "TEXT"],
    ["phone", "TEXT"],
    ["timezone", "TEXT DEFAULT 'UTC'"],
    ["login_enabled", "INTEGER DEFAULT 1"],
    ["must_change_password", "INTEGER DEFAULT 0"],
    ["supervisor_user_id", "TEXT"],
    ["hub_admin", "INTEGER DEFAULT 0"],
    ["hub_access", "TEXT"],
  ];

  for (const [col, definition] of expectedColumns) {
    if (!cols.includes(col)) {
      await safeAddColumn(client, "users", col, definition);
    }
  }

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_org_username ON users(org_id, username)`);
  logger.info("✓ Users auth compatibility migration completed");
}

export async function runCrewCompatibilityMigration(client: LibsqlClient): Promise<void> {
  const cols = await getTableColumns(client, "crew");
  if (!cols.length) {
    return;
  }

  const expectedColumns: Array<[string, string]> = [
    ["employee_id", "TEXT"],
    ["first_name", "TEXT NOT NULL DEFAULT ''"],
    ["last_name", "TEXT NOT NULL DEFAULT ''"],
    ["user_id", "TEXT"],
    ["watch_keeping", "TEXT"],
    ["join_date", "INTEGER"],
    ["photo_path", "TEXT"],
    ["crew_code", "TEXT"],
    ["status", "TEXT DEFAULT 'active'"],
    ["employment_type", "TEXT"],
    ["reports_to_id", "TEXT"],
    ["rotation_on_days", "INTEGER"],
    ["rotation_off_days", "INTEGER"],
  ];

  for (const [col, definition] of expectedColumns) {
    if (!cols.includes(col)) {
      await safeAddColumn(client, "crew", col, definition);
    }
  }

  const refreshedCols = await getTableColumns(client, "crew");
  if (refreshedCols.includes("name") && refreshedCols.includes("first_name")) {
    await client.execute(
      "UPDATE crew SET first_name = name WHERE (first_name IS NULL OR first_name = '') AND name IS NOT NULL"
    );
  }
  if (refreshedCols.includes("status")) {
    await client.execute(
      "UPDATE crew SET status = 'active' WHERE (status IS NULL OR status = '') AND is_active = 1"
    );
  }

  await client.execute("CREATE INDEX IF NOT EXISTS idx_crew_user ON crew(user_id)");
  logger.info("✓ Crew compatibility migration completed");
}

export async function runAdminSessionsCompatibilityMigration(
  client: LibsqlClient
): Promise<void> {
  const cols = await getTableColumns(client, "admin_sessions");
  if (!cols.length) {
    return;
  }

  if (!cols.includes("admin_email")) {
    await safeAddColumn(client, "admin_sessions", "admin_email", "TEXT");
  }
  if (!cols.includes("last_activity_at")) {
    await safeAddColumn(client, "admin_sessions", "last_activity_at", "INTEGER");
  }

  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at)`
  );
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_org ON admin_sessions(org_id)`);
  logger.info("✓ Admin sessions compatibility migration completed");
}

export async function runErrorLogsCompatibilityMigration(client: LibsqlClient): Promise<void> {
  const cols = await getTableColumns(client, "error_logs");
  if (!cols.length) {
    return;
  }

  const expectedColumns: Array<[string, string]> = [
    ["timestamp", "INTEGER"],
    ["category", "TEXT NOT NULL DEFAULT 'application'"],
    ["error_type", "TEXT NOT NULL DEFAULT 'application'"],
    ["error_message", "TEXT"],
    ["error_code", "TEXT"],
    ["message", "TEXT NOT NULL DEFAULT ''"],
    ["user_id", "TEXT"],
    ["request_id", "TEXT"],
    ["endpoint", "TEXT"],
    ["severity", "TEXT NOT NULL DEFAULT 'error'"],
    ["resolved", "INTEGER DEFAULT 0"],
    ["resolved_at", "INTEGER"],
    ["resolved_by", "TEXT"],
    ["created_at", "INTEGER"],
  ];

  for (const [col, definition] of expectedColumns) {
    if (!cols.includes(col)) {
      await safeAddColumn(client, "error_logs", col, definition);
    }
  }

  const refreshedCols = await getTableColumns(client, "error_logs");
  if (refreshedCols.includes("message") && refreshedCols.includes("error_message")) {
    await client.execute(
      `UPDATE error_logs SET message = error_message WHERE (message IS NULL OR message = '') AND error_message IS NOT NULL`
    );
    await client.execute(
      `UPDATE error_logs SET error_message = message WHERE (error_message IS NULL OR error_message = '') AND message IS NOT NULL`
    );
  }
  if (refreshedCols.includes("timestamp") && refreshedCols.includes("created_at")) {
    await client.execute(
      `UPDATE error_logs SET timestamp = created_at WHERE timestamp IS NULL AND created_at IS NOT NULL`
    );
  }

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved)`);
  logger.info("✓ Error logs compatibility migration completed");
}

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
