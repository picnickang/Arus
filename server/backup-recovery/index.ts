/**
 * Backup Recovery Module - Backward-compatible re-exports
 * 
 * MODULARIZED: 669 lines → 7 focused modules (~40-180 lines each)
 */

export { BACKUP_CONFIG } from "./types";
export type { BackupMetadata, BackupResult, RecoveryResult } from "./types";

export { createFullBackup, createSchemaBackup } from "./backup-operations";

export { listBackups } from "./metadata-store";

export { cleanupOldBackups, verifyBackupIntegrity } from "./maintenance";

export { getBackupStatus, scheduleAutomaticBackups } from "./status";
