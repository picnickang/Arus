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
import * as tar from "tar";
import { db } from "../db";
import { softwarePatches } from "../../shared/schema-runtime";
import type { PatchManifest, FileChange } from "./update-checker";
import { eq, and, ne } from "drizzle-orm";
import { assertCloudMode, getCloudTable } from "../utils/cloud-guards";
import crypto from "node:crypto";
import { runTrustedExecutable, validatePath } from "../lib/secure-exec";
import { createLogger } from "../lib/structured-logger";
import {
  cleanOldPatchBackups,
  createPatchBackup,
  listPatchBackups,
  rollbackPatchBackup,
  type PatchBackupSummary,
} from "./patch-applicator-backups";
const logger = createLogger("Services:PatchApplicator");

/**
 * Tar entry types that are safe to extract to disk. Everything else —
 * symlinks, hardlinks, device nodes, FIFOs and exotic GNU types — is rejected
 * during the pre-extraction scan. Symlink/hardlink entries are the classic
 * tar-slip primitive for writing outside the extraction directory.
 */
const ALLOWED_TAR_ENTRY_TYPES: ReadonlySet<string> = new Set([
  "File",
  "OldFile",
  "ContiguousFile",
  "Directory",
]);

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
    return createPatchBackup(files, this.backupDir, this.appDir, this.getCurrentVersion());
  }

  /**
   * Restore files from backup
   */
  async rollback(backupId: string): Promise<void> {
    return rollbackPatchBackup(backupId, this.backupDir, this.appDir);
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

    // Security: pre-scan every archive entry and refuse the whole archive if
    // any entry is a symlink/hardlink/device, has an absolute path, or escapes
    // the extraction directory. This runs BEFORE extraction so a tar-slip
    // payload never touches the filesystem.
    await this.assertSafeArchive(safePatchPath, safeExtractDir);

    logger.info(`[PatchApplicator] Extracting patch to ${safeExtractDir}...`);

    // Security (S2076): runTrustedExecutable uses constant 'tar' from allowlist
    await runTrustedExecutable("tar", ["-xzf", safePatchPath, "-C", safeExtractDir]);

    logger.info("[PatchApplicator] Patch extracted successfully");
  }

  /**
   * Scan a tar.gz archive and throw if any entry is unsafe to extract: a
   * disallowed type (symlink, hardlink, device, FIFO, …), an absolute path, or
   * a path that escapes `extractDir` (e.g. `../../etc/cron.d/x`). Violations are
   * collected so the error names the offending entries.
   */
  private async assertSafeArchive(patchPath: string, extractDir: string): Promise<void> {
    const violations: string[] = [];
    const safeExtractDir = fs.realpathSync(extractDir);

    await tar.list({
      file: patchPath,
      onReadEntry: (entry: tar.ReadEntry) => {
        const entryPath = String(entry.path);
        const entryType = String(entry.type);

        if (!ALLOWED_TAR_ENTRY_TYPES.has(entryType)) {
          violations.push(`unsupported entry type '${entryType}' (${entryPath})`);
          return;
        }
        if (path.isAbsolute(entryPath)) {
          violations.push(`absolute path '${entryPath}'`);
          return;
        }
        const resolvedEntryPath = path.resolve(safeExtractDir, entryPath);
        const relativeEntryPath = path.relative(safeExtractDir, resolvedEntryPath);
        if (relativeEntryPath.startsWith("..") || path.isAbsolute(relativeEntryPath)) {
          violations.push(`path escapes extraction dir: '${entryPath}'`);
        }
      },
    });

    if (violations.length > 0) {
      throw new Error(
        `Unsafe patch archive rejected (${violations.length} violation(s)): ${violations
          .slice(0, 10)
          .join("; ")}`
      );
    }
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
    // Security: contain both the source (inside the extraction dir) and the
    // destination (inside the app dir). A manifest entry whose path escapes
    // either root (e.g. `../../etc/passwd`) is rejected before any I/O.
    const sourcePath = validatePath(extractDir, change.path);
    const destPath = validatePath(this.appDir, change.path);

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

      // Security: Validate migration path to prevent path traversal AND
      // require it to live under <extractDir>/migrations/, so a manifest can
      // never point `db.execute` / `node` at an arbitrary extracted file.
      const migrationPath = validatePath(extractDir, migration.file);
      const migrationsRoot = path.resolve(extractDir, "migrations");
      if (
        migrationPath !== migrationsRoot &&
        !migrationPath.startsWith(migrationsRoot + path.sep)
      ) {
        throw new Error(`Migration file must live under migrations/: ${migration.file}`);
      }

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
   * Enforce update-package trust before applying.
   *
   * Verifies the manifest's Ed25519 signature against
   * `UPDATE_SIGNING_PUBLIC_KEY`. Fails closed: if no public key is configured
   * the patch is refused, UNLESS this is a non-production environment that has
   * explicitly opted into unsigned patches via `ALLOW_UNSIGNED_PATCHES=true`
   * (logged loudly). Production always enforces; a present-but-invalid
   * signature is always rejected regardless of environment.
   */
  private async verifyPatchTrust(manifest: PatchManifest): Promise<void> {
    const publicKeyHex = process.env["UPDATE_SIGNING_PUBLIC_KEY"];
    const isProduction = process.env["NODE_ENV"] === "production";
    const allowUnsigned = !isProduction && process.env["ALLOW_UNSIGNED_PATCHES"] === "true";

    if (!publicKeyHex) {
      if (allowUnsigned) {
        logger.warn(
          "[PatchApplicator] UPDATE_SIGNING_PUBLIC_KEY is unset and ALLOW_UNSIGNED_PATCHES=true " +
            "(non-production) — applying patch WITHOUT signature verification. This MUST NOT be used in production."
        );
        return;
      }
      throw new Error(
        "Patch signature cannot be verified: UPDATE_SIGNING_PUBLIC_KEY is not configured. Refusing to apply patch."
      );
    }

    // Lazy import so update-checker's eager singleton is not pulled into this
    // module's load (and only constructed when a signing key is actually set).
    const { getUpdateChecker } = await import("./update-checker");
    const checker = await getUpdateChecker();
    const verified = await checker.verifySignature(manifest, publicKeyHex);
    if (!verified) {
      throw new Error("Patch signature verification failed. Refusing to apply untrusted patch.");
    }

    logger.info("[PatchApplicator] Patch signature verified.");
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

      // Security: verify the patch is signed and trusted BEFORE doing any work.
      // Fails closed — an unsigned/unverifiable patch is never applied (except
      // an explicit non-production escape hatch).
      await this.verifyPatchTrust(manifest);

      // Atomically claim the patch for application. Only transition to
      // "applying" if it isn't already being applied (or applied): a second
      // concurrent apply then matches 0 rows and aborts here, before any
      // extraction / file writes / migrations — preventing double-apply,
      // conflicting writes, and duplicate migrations.
      const claimed = await db
        .update(patchesTable)
        .set({ status: "applying" })
        .where(
          and(
            eq(patchesTable.id, patchId),
            ne(patchesTable.status, "applying"),
            ne(patchesTable.status, "applied")
          )
        )
        .returning({ id: patchesTable.id });
      if (claimed.length === 0) {
        // Lost the race (or already applied). Return WITHOUT throwing so we
        // don't enter the catch below and clobber the winning apply's
        // "applying" status to "failed" / trigger a spurious rollback.
        logger.warn(
          `[PatchApplicator] Patch ${patchId} is already being applied or applied; skipping concurrent apply`
        );
        return {
          success: false,
          appliedFiles,
          failedFiles,
          error: `Patch ${patchId} is already being applied or has already been applied`,
          backupId,
        };
      }

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
  listBackups(): PatchBackupSummary[] {
    return listPatchBackups(this.backupDir);
  }

  /**
   * Clean old backups (keep last N)
   */
  cleanOldBackups(keepCount: number = 10): void {
    cleanOldPatchBackups(this.backupDir, keepCount);
  }
}

// Lazy singleton: the constructor calls assertCloudMode, so eager
// instantiation at module eval crashed vessel-mode imports of any module in
// this file's import graph (update-scheduler). Construct on first use only —
// cloud-only call sites are already behind isCloudMode guards.
let patchApplicatorInstance: PatchApplicator | null = null;

export function getPatchApplicator(): PatchApplicator {
  if (!patchApplicatorInstance) {
    patchApplicatorInstance = new PatchApplicator();
  }
  return patchApplicatorInstance;
}
