import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  unique,
  index,
  createInsertSchema,
  z,
} from "../base";
import { organizations } from "../core";
import { devices } from "../equipment";

// ============================================================================
// SYNC PROTOCOL VERSION
// ============================================================================

export const syncProtocolVersion = pgTable(
  "sync_protocol_version",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    deviceId: varchar("device_id")
      .notNull()
      .references(() => devices.id),
    protocolVersion: varchar("protocol_version", { length: 20 }).notNull(),
    schemaVersion: varchar("schema_version", { length: 20 }).notNull(),
    appVersion: varchar("app_version", { length: 20 }).notNull(),
    minCompatibleVersion: varchar("min_compatible_version", { length: 20 }).notNull(),
    maxCompatibleVersion: varchar("max_compatible_version", { length: 20 }),
    syncStatus: text("sync_status").notNull().default("compatible"),
    lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
    lastSyncSuccess: boolean("last_sync_success").default(true),
    lastSyncError: text("last_sync_error"),
    registeredAt: timestamp("registered_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_sync_protocol_org_id").on(table.orgId),
    deviceIdIdx: index("idx_sync_protocol_device").on(table.deviceId),
    statusIdx: index("idx_sync_protocol_status").on(table.syncStatus),
  })
);

export const insertSyncProtocolVersionSchema = createInsertSchema(syncProtocolVersion).omit({
  id: true,
  registeredAt: true,
  updatedAt: true,
});

export type SyncProtocolVersion = typeof syncProtocolVersion.$inferSelect;
export type InsertSyncProtocolVersion = z.infer<typeof insertSyncProtocolVersionSchema>;

// ============================================================================
// STORAGE CONFIG
// ============================================================================

export const storageConfig = pgTable("storage_config", {
  id: varchar("id").primaryKey(),
  kind: varchar("kind", { length: 20 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  isDefault: boolean("is_default").default(false),
  mirror: boolean("mirror").default(false),
  cfg: jsonb("cfg").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const insertStorageConfigSchema = createInsertSchema(storageConfig).omit({
  createdAt: true,
  updatedAt: true,
});

export type StorageConfig = typeof storageConfig.$inferSelect;
export type InsertStorageConfig = z.infer<typeof insertStorageConfigSchema>;

// ============================================================================
// OPS DB STAGED
// ============================================================================

export const opsDbStaged = pgTable("ops_db_staged", {
  id: integer("id").primaryKey().default(1),
  url: text("url"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const insertOpsDbStagedSchema = createInsertSchema(opsDbStaged).omit({
  createdAt: true,
});

export type OpsDbStaged = typeof opsDbStaged.$inferSelect;
export type InsertOpsDbStaged = z.infer<typeof insertOpsDbStagedSchema>;

// ============================================================================
// BEAST MODE CONFIG
// ============================================================================

export const beastModeConfig = pgTable(
  "beast_mode_config",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    featureName: text("feature_name").notNull(),
    enabled: boolean("enabled").default(false),
    configuration: jsonb("configuration"),
    lastModifiedBy: text("last_modified_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniqueOrgFeature: unique().on(table.orgId, table.featureName),
  })
);

export const insertBeastModeConfigSchema = createInsertSchema(beastModeConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BeastModeConfig = typeof beastModeConfig.$inferSelect;
export type InsertBeastModeConfig = z.infer<typeof insertBeastModeConfigSchema>;
