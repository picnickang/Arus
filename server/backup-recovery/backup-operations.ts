/**
 * Backup Operations - Core backup creation functions
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { BACKUP_CONFIG, type BackupMetadata, type BackupResult } from "./types";
import { executePgDump } from "./pg-dump-executor";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("BackupRecovery:BackupOperations");
import {
  generateBackupId,
  determineRetentionType,
  getDatabaseVersion,
  calculateFileChecksum,
  formatBytes,
} from "./utils";
import { storeBackupMetadata } from "./metadata-store";

export async function createFullBackup(): Promise<BackupResult> {
  const startTime = Date.now();
  const backupId = generateBackupId();
  const timestamp = new Date();
  const filename = `arus_full_backup_${backupId}.sql${BACKUP_CONFIG.compression.enabled ? ".gz" : ""}`;
  const filepath = join(BACKUP_CONFIG.backupDir, filename);

  try {
    await fs.mkdir(BACKUP_CONFIG.backupDir, { recursive: true });

    logger.info(`🗄️  Starting full database backup: ${filename}`);

    const dbUrl = new URL(process.env['DATABASE_URL']!);

    const pgDumpArgs = [
      "--verbose",
      "--no-owner",
      "--no-privileges",
      "--format=plain",
      "--inserts",
      "--disable-triggers",
      `--host=${dbUrl.hostname}`,
      `--port=${dbUrl.port || "5432"}`,
      `--username=${dbUrl.username}`,
      `--dbname=${dbUrl.pathname.slice(1)}`,
    ];

    const metadata: BackupMetadata = {
      id: backupId,
      type: "full",
      filename,
      filepath,
      size: 0,
      timestamp,
      databaseVersion: await getDatabaseVersion(),
      retentionType: determineRetentionType(timestamp),
      status: "creating",
    };

    const backupSize = await executePgDump(pgDumpArgs, filepath, dbUrl.password || "");

    let checksum: string | undefined;
    if (BACKUP_CONFIG.validation.checksumEnabled) {
      checksum = await calculateFileChecksum(filepath);
    }

    metadata.size = backupSize;
    if (checksum !== undefined) metadata.checksum = checksum;
    metadata.status = "completed";

    await storeBackupMetadata(metadata);

    const duration = Date.now() - startTime;
    logger.info(`✅ Full backup completed: ${filename} (${formatBytes(backupSize)} in ${duration}ms)`);

    return {
      success: true,
      metadata,
      duration,
      size: backupSize,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ Full backup failed:`, undefined, errorMessage);

    const failedMetadata: BackupMetadata = {
      id: backupId,
      type: "full",
      filename,
      filepath,
      size: 0,
      timestamp,
      databaseVersion: await getDatabaseVersion(),
      retentionType: determineRetentionType(timestamp),
      status: "failed",
      errorMessage,
    };

    try {
      await storeBackupMetadata(failedMetadata);
    } catch (metadataError) {
      logger.error(`Failed to store backup failure metadata:`, undefined, metadataError);
    }

    return {
      success: false,
      error: errorMessage,
      duration,
    };
  }
}

export async function createSchemaBackup(): Promise<BackupResult> {
  const startTime = Date.now();
  const backupId = generateBackupId();
  const timestamp = new Date();
  const filename = `arus_schema_backup_${backupId}.sql`;
  const filepath = join(BACKUP_CONFIG.backupDir, filename);

  try {
    await fs.mkdir(BACKUP_CONFIG.backupDir, { recursive: true });

    logger.info(`📋 Starting schema backup: ${filename}`);

    const dbUrl = new URL(process.env['DATABASE_URL']!);

    const pgDumpArgs = [
      "--verbose",
      "--no-owner",
      "--no-privileges",
      "--schema-only",
      "--format=plain",
      `--host=${dbUrl.hostname}`,
      `--port=${dbUrl.port || "5432"}`,
      `--username=${dbUrl.username}`,
      `--dbname=${dbUrl.pathname.slice(1)}`,
    ];

    const metadata: BackupMetadata = {
      id: backupId,
      type: "schema_only",
      filename,
      filepath,
      size: 0,
      timestamp,
      databaseVersion: await getDatabaseVersion(),
      retentionType: "daily",
      status: "creating",
    };

    const backupSize = await executePgDump(pgDumpArgs, filepath, dbUrl.password || "");

    let checksum: string | undefined;
    if (BACKUP_CONFIG.validation.checksumEnabled) {
      checksum = await calculateFileChecksum(filepath);
    }

    metadata.size = backupSize;
    if (checksum !== undefined) metadata.checksum = checksum;
    metadata.status = "completed";

    await storeBackupMetadata(metadata);

    const duration = Date.now() - startTime;
    logger.info(`✅ Schema backup completed: ${filename} (${formatBytes(backupSize)} in ${duration}ms)`);

    return {
      success: true,
      metadata,
      duration,
      size: backupSize,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ Schema backup failed:`, undefined, errorMessage);

    const failedMetadata: BackupMetadata = {
      id: backupId,
      type: "schema_only",
      filename,
      filepath,
      size: 0,
      timestamp,
      databaseVersion: await getDatabaseVersion(),
      retentionType: "daily",
      status: "failed",
      errorMessage,
    };

    try {
      await storeBackupMetadata(failedMetadata);
    } catch (metadataError) {
      logger.error(`Failed to store backup failure metadata:`, undefined, metadataError);
    }

    return {
      success: false,
      error: errorMessage,
      duration,
    };
  }
}
