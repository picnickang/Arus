/**
 * Backup Maintenance - Cleanup and verification operations
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("BackupRecovery:Maintenance");
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { BACKUP_CONFIG } from "./types";
import { listBackups } from "./metadata-store";
import { calculateFileChecksum } from "./utils";

export async function cleanupOldBackups(): Promise<{
  deletedCount: number;
  errors: string[];
}> {
  const backups = await listBackups();
  const errors: string[] = [];
  let deletedCount = 0;

  const backupsByType = {
    daily: backups.filter((b) => b.retentionType === "daily"),
    weekly: backups.filter((b) => b.retentionType === "weekly"),
    monthly: backups.filter((b) => b.retentionType === "monthly"),
  };

  for (const [type, typeBackups] of Object.entries(backupsByType)) {
    const retentionLimit = BACKUP_CONFIG.retention[type as keyof typeof BACKUP_CONFIG.retention];
    const toDelete = typeBackups.slice(retentionLimit);

    for (const backup of toDelete) {
      try {
        await fs.unlink(backup.filepath);
        await fs.unlink(join(BACKUP_CONFIG.backupDir, `${backup.id}.metadata.json`));
        deletedCount++;
        logger.info(`🗑️  Deleted old backup: ${backup.filename}`);
      } catch (error) {
        const errorMsg = `Failed to delete backup ${backup.filename}: ${error}`;
        errors.push(errorMsg);
        logger.error(String(errorMsg));
      }
    }
  }

  return { deletedCount, errors };
}

export async function verifyBackupIntegrity(backupId: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    const backups = await listBackups();
    const backup = backups.find((b) => b.id === backupId);

    if (!backup) {
      return { valid: false, error: "Backup not found" };
    }

    try {
      await fs.access(backup.filepath);
    } catch (error) {
      return { valid: false, error: "Backup file not found" };
    }

    if (backup.checksum) {
      const currentChecksum = await calculateFileChecksum(backup.filepath);
      if (currentChecksum !== backup.checksum) {
        return { valid: false, error: "Checksum mismatch - backup file may be corrupted" };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
