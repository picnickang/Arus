/**
 * Schema Ops Deployment - Software Patching and Fleet Update Rollout
 *
 * Includes patch catalog, per-org/vessel update settings, fleet-wide
 * update status tracking, and patch download progress.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  index,
  createInsertSchema,
  z,
} from "./base";
import { organizations, users } from "./core";
import { vessels } from "./vessels";
import { devices } from "./equipment";

// ============================================================================
// SOFTWARE PATCHES
// ============================================================================
//
// P2 #17 — tenant scoping: TENANT-SCOPED. Every row carries org_id
// (notNull) and the (org_id, version) index is the primary lookup.
// Patch availability, applied status, and rollback state are scoped
// per-org so an operator on tenant A cannot observe tenant B's
// patch rollouts.

export const softwarePatches = pgTable(
  "software_patches",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    version: varchar("version", { length: 50 }).notNull(),
    fromVersion: varchar("from_version", { length: 50 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    patchType: varchar("patch_type", { length: 20 }).notNull().default("incremental"),
    manifest: jsonb("manifest").notNull(),
    signature: text("signature"),
    downloadUrl: text("download_url"),
    fileSize: integer("file_size"),
    checksumSha256: text("checksum_sha256"),
    status: varchar("status", { length: 20 }).notNull().default("available"),
    appliedAt: timestamp("applied_at", { mode: "date" }),
    appliedBy: varchar("applied_by").references(() => users.id),
    errorLog: text("error_log"),
    rollbackAvailable: boolean("rollback_available").default(true),
    requiresRestart: boolean("requires_restart").default(false),
    autoApply: boolean("auto_apply").default(false),
    releaseNotes: text("release_notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgVersionIdx: index("idx_software_patches_org_version").on(table.orgId, table.version),
    statusIdx: index("idx_software_patches_status").on(table.status),
    severityIdx: index("idx_software_patches_severity").on(table.severity, table.status),
  })
);

export const insertSoftwarePatchSchema = createInsertSchema(softwarePatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SoftwarePatch = typeof softwarePatches.$inferSelect;
export type InsertSoftwarePatch = z.infer<typeof insertSoftwarePatchSchema>;

// ============================================================================
// UPDATE SETTINGS
// ============================================================================

export const updateSettings = pgTable(
  "update_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    autoUpdateEnabled: boolean("auto_update_enabled").default(false),
    autoUpdateCriticalOnly: boolean("auto_update_critical_only").default(true),
    updateChannel: varchar("update_channel", { length: 20 }).default("stable"),
    checkInterval: integer("check_interval").default(21600),
    maintenanceWindowStart: varchar("maintenance_window_start", { length: 5 }),
    maintenanceWindowEnd: varchar("maintenance_window_end", { length: 5 }),
    maintenanceWindowTimezone: varchar("maintenance_window_timezone", { length: 50 }).default(
      "UTC"
    ),
    deferUpdatesUntilPort: boolean("defer_updates_until_port").default(false),
    maxDownloadBandwidthKbps: integer("max_download_bandwidth_kbps"),
    requireManualApproval: boolean("require_manual_approval").default(false),
    notifyOnUpdateAvailable: boolean("notify_on_update_available").default(true),
    notifyOnUpdateApplied: boolean("notify_on_update_applied").default(true),
    lastCheckAt: timestamp("last_check_at", { mode: "date" }),
    lastUpdateAt: timestamp("last_update_at", { mode: "date" }),
    currentVersion: varchar("current_version", { length: 50 }),
    githubOwner: varchar("github_owner", { length: 100 }),
    githubRepo: varchar("github_repo", { length: 100 }),
    githubTokenEncrypted: text("github_token_encrypted"),
    githubConfigured: boolean("github_configured").default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgVesselIdx: index("idx_update_settings_org_vessel").on(table.orgId, table.vesselId),
  })
);

export const insertUpdateSettingsSchema = createInsertSchema(updateSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpdateSettings = typeof updateSettings.$inferSelect;
export type InsertUpdateSettings = z.infer<typeof insertUpdateSettingsSchema>;

// ============================================================================
// FLEET UPDATE STATUS
// ============================================================================

export const fleetUpdateStatus = pgTable(
  "fleet_update_status",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    deviceId: varchar("device_id").references(() => devices.id),
    deviceType: varchar("device_type", { length: 50 }).notNull().default("desktop"),
    currentVersion: varchar("current_version", { length: 50 }).notNull(),
    targetVersion: varchar("target_version", { length: 50 }),
    updateChannel: varchar("update_channel", { length: 20 }).default("stable"),
    updateStatus: varchar("update_status", { length: 30 }).notNull().default("up_to_date"),
    lastCheckAt: timestamp("last_check_at", { mode: "date" }),
    lastUpdateAt: timestamp("last_update_at", { mode: "date" }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { mode: "date" }),
    updateProgress: integer("update_progress"),
    errorMessage: text("error_message"),
    updateHistory: jsonb("update_history").default([]),
    osInfo: varchar("os_info", { length: 100 }),
    archInfo: varchar("arch_info", { length: 20 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgVesselIdx: index("idx_fleet_update_status_org_vessel").on(table.orgId, table.vesselId),
    updateStatusIdx: index("idx_fleet_update_status_status").on(table.updateStatus),
    versionIdx: index("idx_fleet_update_status_version").on(table.currentVersion),
  })
);

export const insertFleetUpdateStatusSchema = createInsertSchema(fleetUpdateStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FleetUpdateStatus = typeof fleetUpdateStatus.$inferSelect;
export type InsertFleetUpdateStatus = z.infer<typeof insertFleetUpdateStatusSchema>;

// ============================================================================
// PATCH DOWNLOADS
// ============================================================================

export const patchDownloads = pgTable(
  "patch_downloads",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    patchId: varchar("patch_id")
      .notNull()
      .references(() => softwarePatches.id),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    status: varchar("status", { length: 20 }).notNull().default("queued"),
    bytesDownloaded: integer("bytes_downloaded").default(0),
    totalBytes: integer("total_bytes").default(0),
    downloadSpeed: real("download_speed"),
    eta: integer("eta"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    resumeToken: text("resume_token"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    patchStatusIdx: index("idx_patch_downloads_patch_status").on(table.patchId, table.status),
  })
);

export const insertPatchDownloadSchema = createInsertSchema(patchDownloads).omit({
  id: true,
  createdAt: true,
});

export type PatchDownload = typeof patchDownloads.$inferSelect;
export type InsertPatchDownload = z.infer<typeof insertPatchDownloadSchema>;
