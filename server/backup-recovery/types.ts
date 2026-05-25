/**
 * Backup Types - Interfaces and configuration for backup/recovery system
 *
 * Security Note (S5443 - publicly writable directories):
 * Default backup directory is /tmp for development convenience.
 * In production, BACKUP_DIR environment variable should point to a secure,
 * application-owned directory with restricted permissions (e.g., /var/arus/backups).
 */

export const BACKUP_CONFIG = {
  // NOSONAR: S5443 - /tmp used for development; override with BACKUP_DIR env var in production
  backupDir: process.env['BACKUP_DIR'] || "/tmp/backups",

  retention: {
    daily: 7,
    weekly: 4,
    monthly: 6,
  },

  types: {
    FULL: "full",
    INCREMENTAL: "incremental",
    SCHEMA_ONLY: "schema_only",
  },

  compression: {
    enabled: true,
    level: 6,
  },

  validation: {
    checksumEnabled: true,
    testRestoreEnabled: false,
  },
} as const;

export interface BackupMetadata {
  id: string;
  type: "full" | "schema_only";
  filename: string;
  filepath: string;
  size: number;
  checksum?: string;
  timestamp: Date;
  databaseVersion: string;
  retentionType: "daily" | "weekly" | "monthly";
  status: "creating" | "completed" | "failed" | "corrupted";
  errorMessage?: string;
}

export interface BackupResult {
  success: boolean;
  metadata?: BackupMetadata;
  error?: string;
  duration: number;
  size?: number;
}

export interface RecoveryResult {
  success: boolean;
  restoredTables: string[];
  duration: number;
  error?: string;
}
