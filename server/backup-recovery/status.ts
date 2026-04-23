/**
 * Backup Status - Status reporting and scheduling
 */

import { type BackupMetadata } from "./types";
import { listBackups } from "./metadata-store";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("BackupRecovery:Status");

export async function getBackupStatus(): Promise<{
  totalBackups: number;
  latestBackup: BackupMetadata | null;
  backupSizeTotal: number;
  retentionSummary: Record<string, number>;
  healthStatus: "healthy" | "warning" | "error";
  issues: string[];
}> {
  try {
    const backups = await listBackups();
    const issues: string[] = [];

    const totalBackups = backups.length;
    const latestBackup = backups[0] || null;
    const backupSizeTotal = backups.reduce((sum, b) => sum + b.size, 0);

    const retentionSummary = {
      daily: backups.filter((b) => b.retentionType === "daily").length,
      weekly: backups.filter((b) => b.retentionType === "weekly").length,
      monthly: backups.filter((b) => b.retentionType === "monthly").length,
    };

    let healthStatus: "healthy" | "warning" | "error" = "healthy";

    if (totalBackups === 0) {
      healthStatus = "error";
      issues.push("No backups found");
    } else if (latestBackup) {
      const hoursAgo = (Date.now() - new Date(latestBackup.timestamp).getTime()) / (1000 * 60 * 60);
      if (hoursAgo > 48) {
        healthStatus = "warning";
        issues.push(`Latest backup is ${Math.round(hoursAgo)} hours old`);
      }
    }

    const failedBackups = backups.filter((b) => b.status === "failed").length;
    if (failedBackups > 0) {
      healthStatus = failedBackups > 2 ? "error" : "warning";
      issues.push(`${failedBackups} failed backup(s) found`);
    }

    return {
      totalBackups,
      latestBackup,
      backupSizeTotal,
      retentionSummary,
      healthStatus,
      issues,
    };
  } catch {
    return {
      totalBackups: 0,
      latestBackup: null,
      backupSizeTotal: 0,
      retentionSummary: { daily: 0, weekly: 0, monthly: 0 },
      healthStatus: "error",
      issues: [`Failed to get backup status: ${error}`],
    };
  }
}

export function scheduleAutomaticBackups(): void {
  logger.info("📅 Automatic backup scheduling would be configured here");
  logger.info("💡 In production, integrate with node-cron or system cron for:");
  logger.info("   - Daily full backups at 2:00 AM");
  logger.info("   - Schema backups every 6 hours");
  logger.info("   - Weekly cleanup of old backups");
}
