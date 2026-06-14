import * as fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { validatePath } from "../lib/secure-exec";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Services:PatchApplicator");

export interface PatchBackupSummary {
  id: string;
  timestamp: string;
  files: string[];
  version: string;
}

export async function createPatchBackup(
  files: string[],
  backupDir: string,
  appDir: string,
  appVersion: string
): Promise<string> {
  const backupId = `backup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const backupPath = path.join(backupDir, backupId);

  fs.mkdirSync(backupPath, { recursive: true });

  logger.info(`[PatchApplicator] Creating backup: ${backupId}`);

  for (const file of files) {
    // Security: contain both the backup source and destination.
    const sourcePath = validatePath(appDir, file);

    if (fs.existsSync(sourcePath)) {
      const destPath = validatePath(backupPath, file);
      const destDir = path.dirname(destPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(sourcePath, destPath);
    }
  }

  const manifest = {
    id: backupId,
    timestamp: new Date().toISOString(),
    files,
    appVersion,
  };

  fs.writeFileSync(path.join(backupPath, "manifest.json"), JSON.stringify(manifest, null, 2));

  logger.info(`[PatchApplicator] Backup created: ${backupId} (${files.length} files)`);
  return backupId;
}

export async function rollbackPatchBackup(
  backupId: string,
  backupDir: string,
  appDir: string
): Promise<void> {
  const backupPath = path.join(backupDir, backupId);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupId}`);
  }

  logger.info(`[PatchApplicator] Rolling back to backup: ${backupId}`);

  const manifestPath = path.join(backupPath, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const files: string[] = Array.isArray(manifest.files) ? manifest.files : [];

  for (const file of files) {
    // Security: contain both source and destination, mirroring
    // createPatchBackup. The manifest is read from disk, so a tampered or
    // malicious entry must not let rollback write outside appDir.
    const sourcePath = validatePath(backupPath, file);
    const destPath = validatePath(appDir, file);

    if (fs.existsSync(sourcePath)) {
      const destDir = path.dirname(destPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(sourcePath, destPath);
      logger.info(`[PatchApplicator] Restored: ${file}`);
    }
  }

  logger.info(`[PatchApplicator] Rollback complete: ${backupId}`);
}

export function listPatchBackups(backupDir: string): PatchBackupSummary[] {
  const backups: PatchBackupSummary[] = [];

  if (!fs.existsSync(backupDir)) {
    return backups;
  }

  const entries = fs.readdirSync(backupDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("backup-")) {
      const manifestPath = path.join(backupDir, entry.name, "manifest.json");

      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        backups.push({
          id: manifest.id,
          timestamp: manifest.timestamp,
          files: manifest.files,
          version: manifest.appVersion,
        });
      }
    }
  }

  return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function cleanOldPatchBackups(backupDir: string, keepCount: number = 10): void {
  const backups = listPatchBackups(backupDir);

  if (backups.length <= keepCount) {
    return;
  }

  const toDelete = backups.slice(keepCount);

  logger.info(`[PatchApplicator] Cleaning ${toDelete.length} old backups...`);

  for (const backup of toDelete) {
    const backupPath = path.join(backupDir, backup.id);
    fs.rmSync(backupPath, { recursive: true, force: true });
    logger.info(`[PatchApplicator] Deleted backup: ${backup.id}`);
  }
}
