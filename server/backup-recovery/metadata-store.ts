/**
 * Backup Metadata Store - Manages backup metadata persistence
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("BackupRecovery:MetadataStore");
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { BACKUP_CONFIG, type BackupMetadata } from "./types";

const backupMetadataStore = new Map<string, BackupMetadata>();

export async function storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
  backupMetadataStore.set(metadata.id, metadata);

  const metadataFile = join(BACKUP_CONFIG.backupDir, `${metadata.id}.metadata.json`);
  // Restrict to owner-only; the backup dir may live under a shared temp root.
  await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2), { mode: 0o600 });
}

export async function listBackups(): Promise<BackupMetadata[]> {
  try {
    const files = await fs.readdir(BACKUP_CONFIG.backupDir);
    const metadataFiles = files.filter((f) => f.endsWith(".metadata.json"));

    const backups: BackupMetadata[] = [];
    for (const file of metadataFiles) {
      try {
        const content = await fs.readFile(join(BACKUP_CONFIG.backupDir, file), "utf8");
        const metadata = JSON.parse(content) as BackupMetadata;
        backups.push(metadata);
      } catch (error) {
        logger.warn(`Failed to load backup metadata ${file}:`, { details: error });
      }
    }

    return backups.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    logger.error("Failed to list backups:", undefined, error);
    return [];
  }
}
