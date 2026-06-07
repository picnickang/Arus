/**
 * Update Checker Service
 * Checks for available software patches and coordinates update downloads
 * Part of ARUS 3-Tier Patching System - Tier 2
 *
 * DEPLOYMENT MODE: This service is CLOUD-ONLY.
 * Vessel/embedded deployments use different update channels.
 */

import { db } from "../db";
import { softwarePatches, updateSettings, patchDownloads } from "../../shared/schema-runtime";
import type { SoftwarePatch, InsertSoftwarePatch, UpdateSettings } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { assertCloudMode, getCloudTable } from "../utils/cloud-guards";
import crypto from "node:crypto";
import https from "node:https";
import * as fs from "node:fs";
import path from "node:path";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Services:UpdateChecker");
import type {
  IUpdateDistributionProvider,
  PatchManifest,
  FileChange,
  DatabaseMigration,
} from "./update-provider";
import { createUpdateProvider, getProviderConfigFromEnv } from "./update-provider";

// Re-export types for backward compatibility
export type { PatchManifest, FileChange, DatabaseMigration };

/**
 * UpdateChecker handles checking for and managing software updates
 */
export class UpdateChecker {
  private provider: IUpdateDistributionProvider;
  private currentVersion: string;
  private patchDir: string;

  private constructor(provider: IUpdateDistributionProvider, currentVersion?: string) {
    this.provider = provider;
    this.currentVersion = currentVersion || this.getCurrentVersion();
    this.patchDir = path.resolve(process.cwd(), "patches");

    // Ensure patch directory exists
    if (!fs.existsSync(this.patchDir)) {
      fs.mkdirSync(this.patchDir, { recursive: true });
    }
  }

  /**
   * Create a new UpdateChecker instance with async provider initialization
   *
   * CLOUD-ONLY: This service requires PostgreSQL and cloud-only tables
   */
  static async create(
    provider?: IUpdateDistributionProvider,
    currentVersion?: string
  ): Promise<UpdateChecker> {
    // GUARD: Update checker is cloud-only
    assertCloudMode("Update Checker Service");

    const actualProvider = provider || (await createUpdateProvider(getProviderConfigFromEnv()));
    return new UpdateChecker(actualProvider, currentVersion);
  }

  /**
   * Get current application version from package.json
   */
  private getCurrentVersion(): string {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
      );
      return packageJson.version || "1.0";
    } catch {
      logger.warn("[UpdateChecker] Could not read version from package.json, using default");
      return "1.0";
    }
  }

  /**
   * Check for available updates using the configured provider
   */
  async checkForUpdates(orgId: string, channel: string = "stable"): Promise<PatchManifest | null> {
    try {
      logger.info(`[UpdateChecker] Checking for updates (current: ${this.currentVersion}, channel: ${channel})`);

      // Get update settings for this organization
      const settings = await this.getUpdateSettings(orgId);
      if (settings && !settings.autoUpdateEnabled) {
        logger.info("[UpdateChecker] Auto-update is disabled for this organization");
        return null;
      }

      // Update last check timestamp
      await this.updateLastCheckTime(orgId);

      // Fetch available updates from provider (GitHub or custom server)
      const manifest = await this.provider.fetchLatestManifest(this.currentVersion, channel);

      if (!manifest) {
        logger.info("[UpdateChecker] No updates available");
        return null;
      }

      // Check if we've already applied this version
      const patchesTable = getCloudTable(softwarePatches, "Software Patches");
      const existing = await db
        .select()
        .from(patchesTable)
        .where(and(eq(patchesTable.orgId, orgId), eq(patchesTable.version, manifest.version)))
        .limit(1);

      if (existing.length > 0 && existing[0]?.status === "applied") {
        logger.info(`[UpdateChecker] Version ${manifest.version} already applied`);
        return null;
      }

      logger.info(`[UpdateChecker] Update available: ${manifest.version} (${manifest.severity})`);
      return manifest;
    } catch (error) {
      logger.error("[UpdateChecker] Error checking for updates:", undefined, error);
      return null;
    }
  }

  /**
   * Fetch patch manifest from URL
   */
  private async fetchManifest(url: string): Promise<PatchManifest | null> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = "";

          if (res.statusCode === 204 || res.statusCode === 404) {
            // No updates available
            resolve(null);
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`Failed to fetch manifest: HTTP ${res.statusCode}`));
            return;
          }

          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            try {
              const manifest = JSON.parse(data) as PatchManifest;
              resolve(manifest);
            } catch {
              reject(new Error("Invalid manifest JSON"));
            }
          });
        })
        .on("error", reject);
    });
  }

  /**
   * Get or create update settings for organization
   */
  async getUpdateSettings(orgId: string, vesselId?: string): Promise<UpdateSettings | null> {
    try {
      const where = vesselId
        ? and(eq(updateSettings.orgId, orgId), eq(updateSettings.vesselId, vesselId))
        : and(eq(updateSettings.orgId, orgId), sql`${updateSettings.vesselId} IS NULL`);

      const settings = await db.select().from(updateSettings).where(where).limit(1);

      return settings[0] || null;
    } catch (error) {
      logger.error("[UpdateChecker] Error fetching update settings:", undefined, error);
      return null;
    }
  }

  /**
   * Update last check timestamp
   */
  private async updateLastCheckTime(orgId: string): Promise<void> {
    try {
      await db
        .update(updateSettings)
        .set({
          lastCheckAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(updateSettings.orgId, orgId), sql`${updateSettings.vesselId} IS NULL`));
    } catch (error) {
      logger.error("[UpdateChecker] Error updating last check time:", undefined, error);
    }
  }

  /**
   * Register a patch in the database
   */
  async registerPatch(orgId: string, manifest: PatchManifest): Promise<SoftwarePatch> {
    const patchData: InsertSoftwarePatch = {
      orgId,
      version: manifest.version,
      fromVersion: manifest.fromVersion,
      severity: manifest.severity,
      patchType: manifest.patchType,
      manifest: manifest as object as Record<string, unknown>,
      signature: manifest.signature,
      downloadUrl: manifest.downloadUrl,
      fileSize: manifest.fileSize,
      checksumSha256: manifest.checksumSha256,
      status: "available",
      requiresRestart: manifest.requiresRestart,
      autoApply: manifest.severity === "critical",
      releaseNotes: manifest.releaseNotes,
    };

    const [patch] = await db.insert(softwarePatches).values(patchData).returning();
    if (!patch) {throw new Error("recordAvailableUpdate: insert returned no row");}
    return patch;
  }

  /**
   * Verify patch signature using Ed25519
   */
  async verifySignature(manifest: PatchManifest, publicKeyHex: string): Promise<boolean> {
    try {
      if (!manifest.signature) {
        logger.warn("[UpdateChecker] No signature provided for patch");
        return false;
      }

      // Create message to verify (deterministic JSON string)
      const message = JSON.stringify({
        version: manifest.version,
        fromVersion: manifest.fromVersion,
        changes: manifest.changes,
        checksumSha256: manifest.checksumSha256,
      });

      // Create Ed25519 verification using Node.js crypto
      const publicKey = crypto.createPublicKey({
        key: Buffer.from(publicKeyHex, "hex"),
        format: "der",
        type: "spki",
      });

      const signature = Buffer.from(manifest.signature, "base64");

      return crypto.verify(null, Buffer.from(message), publicKey, signature);
    } catch (error) {
      logger.error("[UpdateChecker] Signature verification failed:", undefined, error);
      return false;
    }
  }

  /**
   * Calculate SHA256 hash of a file
   */
  private calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  /**
   * Download a file from URL with progress tracking
   */
  async downloadFile(
    url: string,
    destination: string,
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination);

      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
            return;
          }

          const totalBytes = Number.parseInt(response.headers["content-length"] || "0", 10);
          let downloadedBytes = 0;

          response.on("data", (chunk) => {
            downloadedBytes += chunk.length;
            if (onProgress) {
              onProgress(downloadedBytes, totalBytes);
            }
          });

          response.pipe(file);

          file.on("finish", () => {
            file.close();
            resolve();
          });

          file.on("error", (err) => {
            fs.unlinkSync(destination);
            reject(err);
          });
        })
        .on("error", (err) => {
          fs.unlinkSync(destination);
          reject(err);
        });
    });
  }

  /**
   * Download and verify a patch
   */
  async downloadPatch(patchId: string, orgId: string): Promise<string> {
    try {
      // Get patch from database
      const patchesTable = getCloudTable(softwarePatches, "Software Patches");
      const downloadsTable = getCloudTable(patchDownloads, "Patch Downloads");

      const [patch] = await db
        .select()
        .from(patchesTable)
        .where(eq(patchesTable.id, patchId))
        .limit(1);

      if (!patch) {
        throw new Error("Patch not found");
      }

      // Create download record
      const [download] = await db
        .insert(downloadsTable)
        .values({
          patchId,
          orgId,
          status: "downloading",
          totalBytes: patch.fileSize || 0,
        })
        .returning();
      if (!download) {throw new Error("downloadPatch: downloads insert returned no row");}

      // Download to temporary file
      const filename = `patch-${patch.version}.tar.gz`;
      const tempPath = path.join(this.patchDir, `temp-${download.id}-${filename}`);
      const finalPath = path.join(this.patchDir, filename);

      logger.info(`[UpdateChecker] Downloading patch ${patch.version}...`);

      // Update patch status
      await db
        .update(patchesTable)
        .set({ status: "downloading" })
        .where(eq(patchesTable.id, patchId));

      // Download with progress tracking using provider
      await this.provider.downloadAsset(patch.downloadUrl!, tempPath, async (downloaded, total) => {
        await db
          .update(downloadsTable)
          .set({
            bytesDownloaded: downloaded,
            totalBytes: total,
            downloadSpeed: total > 0 ? downloaded / total : 0,
          })
          .where(eq(downloadsTable.id, download.id));
      });

      // Verify checksum
      logger.info("[UpdateChecker] Verifying patch integrity...");
      const actualHash = await this.calculateFileHash(tempPath);

      if (actualHash !== patch.checksumSha256) {
        fs.unlinkSync(tempPath);
        throw new Error("Checksum verification failed");
      }

      // Move to final location
      fs.renameSync(tempPath, finalPath);

      // Update download status
      await db
        .update(downloadsTable)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(downloadsTable.id, download.id));

      logger.info(`[UpdateChecker] Patch downloaded successfully: ${finalPath}`);
      return finalPath;
    } catch (error) {
      logger.error("[UpdateChecker] Patch download failed:", undefined, error);

      // Update status to failed
      const patchesTable = getCloudTable(softwarePatches, "Software Patches");
      await db
        .update(patchesTable)
        .set({
          status: "failed",
          errorLog: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(patchesTable.id, patchId));

      throw error;
    }
  }

  /**
   * Check if a patch should be auto-applied
   */
  async shouldAutoApply(patchId: string, orgId: string): Promise<boolean> {
    const patchesTable = getCloudTable(softwarePatches, "Software Patches");
    const [patch] = await db
      .select()
      .from(patchesTable)
      .where(eq(patchesTable.id, patchId))
      .limit(1);

    if (!patch) {
      return false;
    }

    const settings = await this.getUpdateSettings(orgId);

    if (!settings || !settings.autoUpdateEnabled) {
      return false;
    }

    // Auto-apply if critical and settings allow it
    if (patch.severity === "critical" && !settings.autoUpdateCriticalOnly) {
      return true;
    }

    // Auto-apply if severity matches settings
    return patch.autoApply === true;
  }

  /**
   * Get list of available patches for an organization
   */
  async getAvailablePatches(orgId: string): Promise<SoftwarePatch[]> {
    const patchesTable = getCloudTable(softwarePatches, "Software Patches");
    return db
      .select()
      .from(patchesTable)
      .where(and(eq(patchesTable.orgId, orgId), eq(patchesTable.status, "available")))
      .orderBy(sql`${patchesTable.createdAt} DESC`);
  }

  /**
   * Get patch history for an organization
   */
  async getPatchHistory(orgId: string, limit: number = 50): Promise<SoftwarePatch[]> {
    const patchesTable = getCloudTable(softwarePatches, "Software Patches");
    return db
      .select()
      .from(patchesTable)
      .where(eq(patchesTable.orgId, orgId))
      .orderBy(sql`${patchesTable.createdAt} DESC`)
      .limit(limit);
  }
}

// Singleton instance - initialized lazily
let updateCheckerInstance: UpdateChecker | null = null;

export async function getUpdateChecker(): Promise<UpdateChecker> {
  if (!updateCheckerInstance) {
    updateCheckerInstance = await UpdateChecker.create();
  }
  return updateCheckerInstance;
}

// For backward compatibility - use getUpdateChecker() instead
export const updateChecker: Promise<UpdateChecker> = getUpdateChecker();
