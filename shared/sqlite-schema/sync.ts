/**
 * SQLite Schema Sync Module
 * Sync journal, outbox, conflicts, idempotency
 */

import { sqliteTable, text, integer, index } from "./base";

export const syncConflictsSqlite = sqliteTable("sync_conflicts", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  conflictType: text("conflict_type").notNull(),
  localVersion: integer("local_version"),
  remoteVersion: integer("remote_version"),
  localData: text("local_data"),
  remoteData: text("remote_data"),
  status: text("status").notNull().default("pending"),
  resolution: text("resolution"),
  resolvedBy: text("resolved_by"),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

export const requestIdempotencySqlite = sqliteTable("request_idempotency", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  requestHash: text("request_hash"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

export const idempotencyLogSqlite = sqliteTable("idempotency_log", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  endpoint: text("endpoint"),
  method: text("method"),
  requestBody: text("request_body"),
  responseBody: text("response_body"),
  status: text("status"),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

export const dbSchemaVersionSqlite = sqliteTable("db_schema_version", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  appliedAt: integer("applied_at", { mode: "timestamp" }),
  description: text("description"),
});

export const sheetLockSqlite = sqliteTable(
  "sheet_locks",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    sheetType: text("sheet_type").notNull(),
    sheetId: text("sheet_id").notNull(),
    lockedBy: text("locked_by"),
    lockedAt: integer("locked_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    reason: text("reason"),
  },
  (table) => ({
    sheetIdx: index("idx_sl_sheet").on(table.sheetType, table.sheetId),
  })
);

export const sheetVersionSqlite = sqliteTable(
  "sheet_versions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    sheetType: text("sheet_type").notNull(),
    sheetId: text("sheet_id").notNull(),
    version: integer("version").notNull(),
    data: text("data"),
    changedBy: text("changed_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    sheetVersionIdx: index("idx_sv_sheet_version").on(table.sheetType, table.sheetId, table.version),
  })
);

export const updateSettingsSqlite = sqliteTable("update_settings", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  autoUpdateEnabled: integer("auto_update_enabled", { mode: "boolean" }).default(true),
  updateChannel: text("update_channel").default("stable"),
  lastCheckAt: integer("last_check_at", { mode: "timestamp" }),
  lastUpdateAt: integer("last_update_at", { mode: "timestamp" }),
  currentVersion: text("current_version"),
  availableVersion: text("available_version"),
  updateNotes: text("update_notes"),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const syncProtocolVersionSqlite = sqliteTable(
  "sync_protocol_version",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    protocolVersion: text("protocol_version").notNull(),
    minClientVersion: text("min_client_version"),
    features: text("features"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgVersionIdx: index("idx_spv_org_version").on(table.orgId, table.protocolVersion),
  })
);
