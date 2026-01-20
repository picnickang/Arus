/**
 * Backup and Disaster Recovery System for ARUS
 * CLOUD-ONLY: PostgreSQL-specific backup/recovery features
 *
 * MODULARIZED: 669 lines → 7 focused modules (~40-180 lines each)
 */

export { BACKUP_CONFIG } from "./backup-recovery/types";
export type { BackupMetadata, BackupResult, RecoveryResult } from "./backup-recovery/types";

export { createFullBackup, createSchemaBackup } from "./backup-recovery/backup-operations";

export { listBackups } from "./backup-recovery/metadata-store";

export { cleanupOldBackups, verifyBackupIntegrity } from "./backup-recovery/maintenance";

export { getBackupStatus, scheduleAutomaticBackups } from "./backup-recovery/status";
