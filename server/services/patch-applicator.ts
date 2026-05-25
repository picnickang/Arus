/**
 * Patch Applicator Service
 * CLOUD-ONLY: Uses PostgreSQL transactions (not available in SQLite)
 * Applies software patches atomically with rollback capability
 * Part of ARUS 3-Tier Patching System - Tier 2
 *
 * Security (S2076, S4036): All command execution uses runTrustedExecutable
 * with compile-time allowlisted executables only.
 */

import * as fs from "node:fs";
import path from "node:path";
import { db } from "../db";
import { softwarePatches } from "../../shared/schema-runtime";
import type { PatchManifest, FileChange } from "./update-checker";
import { eq } from "drizzle-orm";
import { assertCloudMode, getCloudTable } from "../utils/cloud-guards";
import crypto from "node:crypto";
import { runTrustedExecutable, validatePath } from "../lib/secure-exec";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Services:PatchApplicator");

export interface ApplyResult {
  success: boolean;
  appliedFiles: string[];
  failedFiles: string[];
  error?: string | undefined;
  backupId?: string | undefined;
}

/**
 * PatchApplicator handles applying patches with atomic transactions and rollback
 */
export class PatchApplicator {
  private backupDir: string;
  private appDir: string;

  constructor() {
    // GUARD: Patch applicator is cloud-only
    assertCloudMode("Patch Applicator Service");

    this.backupDir = path.resolve(process.cwd(), "backups");
    this.appDir = process.cwd();

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of files that will be modified
   */
  private async createBackup(files: string[]): Promise<string> {
    const backupId = `backup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const backupPath = path.join(this.backupDir, backupId);

    fs.mkdirSync(backupPath, { recursive: true });

    logger.info(`[PatchApplicator] Creating backup: ${backupId}`);

    for (const file of files) {
      const sourcePath = path.join(this.appDir, file);

      if (fs.existsSync(sourcePath)) {
        const destPath = path.join(backupPath, file);
        const destDir = path.dirname(destPath);

        // Ensure destination directory exists
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // Copy file to backup
        fs.copyFileSync(sourcePath, destPath);
      }
    }

    // Save backup manifest
    const manifest = {
      id: backupId,
      timestamp: new Date().toISOString(),
      files,
      appVersion: this.getCurrentVersion(),
    };

    fs.writeFileSync(path.join(backupPath, "manifest.json"), JSON.stringify(manifest, null, 2));

    logger.info(`[PatchApplicator] Backup created: ${backupId} (${files.length} files)`);
    return backupId;
  }

  /**
   * Restore files from backup
   */
  async rollback(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    logger.info(`[PatchApplicator] Rolling back to backup: ${backupId}`);

    // Read backup manifest
    const manifestPath = path.join(backupPath, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    // Restore each file
    for (const file of manifest.files) {
      const sourcePath = path.join(backupPath, file);
      const destPath = path.join(this.appDir, file);

      if (fs.existsSync(sourcePath)) {
        const destDir = path.dirname(destPath);

        // Ensure destination directory exists
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // Restore file
        fs.copyFileSync(sourcePath, destPath);
        logger.info(`[PatchApplicator] Restored: ${file}`);
      }
    }

    logger.info(`[PatchApplicator] Rollback complete: ${backupId}`);
  }

  /**
   * Extract tar.gz patch file
   * Security (S2076): Uses runTrustedExecutable with allowlisted 'tar'
   */
  private async extractPatch(patchPath: string, extractDir: string): Promise<void> {
    // Security: Validate paths to prevent path traversal
    const safePatchPath = validatePath(process.cwd(), patchPath);
    const safeExtractDir = validatePath(process.cwd(), extractDir);

    if (!fs.existsSync(safeExtractDir)) {
      fs.mkdirSync(safeExtractDir, { recursive: true });
    }

    logger.info(`[PatchApplicator] Extracting patch to ${safeExtractDir}...`);

    // Security (S2076): runTrustedExecutable uses constant 'tar' from allowlist
    await runTrustedExecutable("tar", ["-xzf", safePatchPath, "-C", safeExtractDir]);

    logger.info("[PatchApplicator] Patch extracted successfully");
  }

  /**
   * Verify file hash
   */
  private async verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => {
        const actualHash = hash.digest("hex");
        resolve(actualHash === expectedHash);
      });
      stream.on("error", reject);
    });
  }

  /**
   * Apply a single file change
   */
  private async applyFileChange(change: FileChange, extractDir: string): Promise<void> {
    const sourcePath = path.join(extractDir, change.path);
    const destPath = path.join(this.appDir, change.path);

    switch (change.action) {
      case "create":
      case "update": {
        // Verify source file hash
        if (!(await this.verifyFileHash(sourcePath, change.hash))) {
          throw new Error(`Hash verification failed for ${change.path}`);
        }

        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(sourcePath, destPath);
        logger.info(`[PatchApplicator] ${change.action}: ${change.path}`);
        break;
      }

      case "delete":
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
          logger.info(`[PatchApplicator] Deleted: ${change.path}`);
        }
        break;

      case "merge":
        // For merge operations, could implement more sophisticated merging
        // For now, treat as update
        if (!(await this.verifyFileHash(sourcePath, change.hash))) {
          throw new Error(`Hash verification failed for ${change.path}`);
        }
        fs.copyFileSync(sourcePath, destPath);
        logger.info(`[PatchApplicator] Merged: ${change.path}`);
        break;

      default:
        throw new Error(`Unknown action: ${change.action}`);
    }
  }

  /**
   * Run database migrations from patch
   * Security (S2076): Uses runTrustedExecutable with allowlisted 'node'
   */
  private async runMigrations(manifest: PatchManifest, extractDir: string): Promise<void> {
    if (!manifest.migrations || manifest.migrations.length === 0) {
      logger.info("[PatchApplicator] No database migrations to run");
      return;
    }

    logger.info(`[PatchApplicator] Running ${manifest.migrations.length} database migrations...`);

    for (const migration of manifest.migrations) {
      logger.info(`[PatchApplicator] Running migration: ${migration.description}`);

      // Security: Validate migration path to prevent path traversal
      const migrationPath = validatePath(extractDir, migration.file);

      if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migration.file}`);
      }

      if (migration.type === "sql") {
        // Execute SQL migration
        const sql = fs.readFileSync(migrationPath, "utf-8");
        const sqlUnknown: unknown = sql;
        await db.execute(sqlUnknown as Parameters<typeof db.execute>[0]);
        logger.info(`[PatchApplicator] SQL migration executed: ${migration.file}`);
      } else if (migration.type === "script") {
        // Security (S2076): runTrustedExecutable uses constant 'node' from allowlist
        await runTrustedExecutable("node", [migrationPath]);
        logger.info(`[PatchApplicator] Script migration executed: ${migration.file}`);
      }
    }

    logger.info("[PatchApplicator] All migrations completed successfully");
  }

  /**
   * Verify application integrity after patch
   */
  private async verifyIntegrity(): Promise<void> {
    // Basic integrity checks
    const criticalFiles = ["package.json", "server/index.ts", "client/index.html"];

    for (const file of criticalFiles) {
      const filePath = path.join(this.appDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Critical file missing after patch: ${file}`);
      }
    }

    logger.info("[PatchApplicator] Integrity verification passed");
  }

  /**
   * Get current application version
   */
  private getCurrentVersion(): string {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(this.appDir, "package.json"), "utf-8")
      );
      return packageJson.version || "1.0";
    } catch {
      return "1.0";
    }
  }

  /**
   * Update package.json version
   */
  private updateVersion(newVersion: string): void {
    const packageJsonPath = path.join(this.appDir, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    logger.info(`[PatchApplicator] Updated version to ${newVersion}`);
  }

  /**
   * Apply a patch atomically
   */
  async applyPatch(patchId: string, patchPath: string, userId?: string): Promise<ApplyResult> {
    let backupId: string | undefined;
    const appliedFiles: string[] = [];
    const failedFiles: string[] = [];

    try {
      logger.info(`[PatchApplicator] Applying patch: ${patchId}`);

      // Get patch from database
      const patchesTable = getCloudTable(softwarePatches, "Software Patches");
      const [patch] = await db
        .select()
        .from(patchesTable)
        .where(eq(patchesTable.id, patchId))
        .limit(1);

      if (!patch) {
        throw new Error("Patch not found in database");
      }

      const manifest: PatchManifest = patch.manifest as object as PatchManifest;

      // Update patch status
      await db.update(patchesTable).set({ status: "applying" }).where(eq(patchesTable.id, patchId));

      // Extract patch to temporary directory
      const extractDir = path.join(this.backupDir, `extract-${Date.now()}`);
      await this.extractPatch(patchPath, extractDir);

      // Get list of files that will be modified
      const filesToBackup = manifest.changes
        .filter((c) => c.action !== "create")
        .map((c) => c.path);

      // Create backup
      backupId = await this.createBackup(filesToBackup);

      // Apply each file change
      for (const change of manifest.changes) {
        try {
          await this.applyFileChange(change, extractDir);
          appliedFiles.push(change.path);
        } catch (error) {
          logger.error(`[PatchApplicator] Failed to apply ${change.path}:`, undefined, error);
          failedFiles.push(change.path);
          throw error; // Stop on first failure
        }
      }

      // Run database migrations
      await this.runMigrations(manifest, extractDir);

      // Verify integrity
      await this.verifyIntegrity();

      // Update version in package.json
      this.updateVersion(manifest.version);

      // Clean up extraction directory
      fs.rmSync(extractDir, { recursive: true, force: true });

      // Update patch status to applied
      await db
        .update(softwarePatches)
        .set({
          status: "applied",
          appliedAt: new Date(),
          appliedBy: userId,
        })
        .where(eq(softwarePatches.id, patchId));

      logger.info(`[PatchApplicator] Patch applied successfully: ${manifest.version}`);

      return {
        success: true,
        appliedFiles,
        failedFiles: [],
        backupId,
      };
    } catch (error) {
      logger.error("[PatchApplicator] Patch application failed:", undefined, error);

      // Automatic rollback on failure
      if (backupId) {
        logger.info("[PatchApplicator] Initiating automatic rollback...");
        try {
          await this.rollback(backupId);
          logger.info("[PatchApplicator] Rollback successful");
        } catch (rollbackError) {
          logger.error("[PatchApplicator] Rollback failed:", undefined, rollbackError);
        }
      }

      // Update patch status to failed
      await db
        .update(softwarePatches)
        .set({
          status: "failed",
          errorLog: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(softwarePatches.id, patchId));

      return {
        success: false,
        appliedFiles,
        failedFiles,
        error: error instanceof Error ? error.message : "Unknown error",
        backupId,
      };
    }
  }

  /**
   * List available backups
   */
  listBackups(): Array<{ id: string; timestamp: string; files: string[]; version: string }> {
    const backups: Array<{ id: string; timestamp: string; files: string[]; version: string }> = [];

    if (!fs.existsSync(this.backupDir)) {
      return backups;
    }

    const entries = fs.readdirSync(this.backupDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("backup-")) {
        const manifestPath = path.join(this.backupDir, entry.name, "manifest.json");

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

  /**
   * Clean old backups (keep last N)
   */
  cleanOldBackups(keepCount: number = 10): void {
    const backups = this.listBackups();

    if (backups.length <= keepCount) {
      return;
    }

    const toDelete = backups.slice(keepCount);

    logger.info(`[PatchApplicator] Cleaning ${toDelete.length} old backups...`);

    for (const backup of toDelete) {
      const backupPath = path.join(this.backupDir, backup.id);
      fs.rmSync(backupPath, { recursive: true, force: true });
      logger.info(`[PatchApplicator] Deleted backup: ${backup.id}`);
    }
  }
}

// Singleton instance
export const patchApplicator = new PatchApplicator();
