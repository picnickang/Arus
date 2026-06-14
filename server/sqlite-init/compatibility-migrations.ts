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

  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_users_org_username ON users(org_id, username)`
  );
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

export async function runAdminSessionsCompatibilityMigration(client: LibsqlClient): Promise<void> {
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
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_admin_sessions_org ON admin_sessions(org_id)`
  );
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

  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved)`
  );
  logger.info("✓ Error logs compatibility migration completed");
}

export async function runPdmScoreLogsCompatibilityMigration(client: LibsqlClient): Promise<void> {
  const cols = await getTableColumns(client, "pdm_score_logs");
  if (!cols.length) {
    return; // no table yet (ensureDeclaredTablesAndIndexes creates the canonical one)
  }

  // Legacy vessel shape carried score/computed_at as NOT NULL — incompatible with
  // the canonical PG-aligned columns the PdM code reads/writes
  // (ts/health_idx/p_fail_30d/predicted_due_date/context_json). The vessel table
  // is unpopulated today (writers went through the cloud-only undefined table), so
  // recreate with the canonical shape rather than carry dead NOT NULL columns that
  // would block canonical inserts.
  if (cols.includes("score") || !cols.includes("health_idx")) {
    await client.execute(`DROP TABLE IF EXISTS pdm_score_logs`);
    await client.execute(
      `CREATE TABLE pdm_score_logs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, ts INTEGER, health_idx REAL, p_fail_30d REAL, predicted_due_date INTEGER, context_json TEXT, created_at INTEGER)`
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_psl_equipment ON pdm_score_logs(equipment_id)`
    );
    logger.info("✓ Recreated pdm_score_logs with the canonical shape");
  }
}
