/**
 * GitHub Release Provider
 * Implements update distribution using GitHub Releases API
 */

import { Octokit } from "@octokit/rest";
import https from "node:https";
import * as fs from "node:fs";
import { createLogger } from "../lib/structured-logger";
import { cast } from "@shared/lib/type-cast";
const logger = createLogger("Services:GithubReleaseService");
import type {
  IUpdateDistributionProvider,
  PatchManifest,
  GitHubRelease,
  PublishOptions,
} from "./update-provider";

export interface GitHubProviderConfig {
  owner: string;
  repo: string;
  token: string;
  channelTagPrefix?: string;
}

export class GitHubReleaseProvider implements IUpdateDistributionProvider {
  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly repo: string;
  private readonly channelTagPrefix: string;

  constructor(config: GitHubProviderConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
    this.channelTagPrefix = config.channelTagPrefix || "v";
  }

  /**
   * Fetch the latest patch manifest from GitHub Releases
   */
  async fetchLatestManifest(
    currentVersion: string,
    channel: string = "stable"
  ): Promise<PatchManifest | null> {
    try {
      logger.info(`[GitHub] Checking for updates (current: ${currentVersion}, channel: ${channel})`);

      // List all releases
      const releases = await this.listReleases(channel);

      if (!releases.length) {
        logger.info("[GitHub] No releases found");
        return null;
      }

      // Get the latest non-draft, non-prerelease (unless channel is beta)
      const latest = releases.find((r) => {
        if (channel === "beta") {
          return true; // Include prereleases for beta channel
        }
        return !r.draft && !r.prerelease;
      });

      if (!latest) {
        logger.info("[GitHub] No suitable release found");
        return null;
      }

      const latestVersion = this.extractVersion(latest.tag_name);

      // Check if this version is newer than current
      if (!this.isNewerVersion(latestVersion, currentVersion)) {
        logger.info(`[GitHub] Already on latest version (${latestVersion})`);
        return null;
      }

      // Download manifest.json from release assets
      const manifestAsset = latest.assets.find((a) => a.name === "manifest.json");

      if (!manifestAsset) {
        logger.warn(`[GitHub] No manifest.json found in release ${latest.tag_name}`);
        return null;
      }

      // Fetch manifest content
      const manifest = await this.fetchAssetContent<PatchManifest>(
        manifestAsset.browser_download_url
      );

      logger.info(`[GitHub] Update available: ${manifest.version} (${manifest.severity})`);
      return manifest;
    } catch (error) {
      logger.error("[GitHub] Error fetching manifest:", undefined, error);
      return null;
    }
  }

  /**
   * Download a patch asset to local filesystem
   */
  async downloadAsset(
    url: string,
    destination: string,
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination);

      https
        .get(url, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // Follow redirect
            if (response.headers.location) {
              https.get(response.headers.location, handleResponse);
            } else {
              reject(new Error("Redirect without location header"));
            }
            return;
          }

          handleResponse(response);
        })
        .on("error", reject);

      function handleResponse(response: any) {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        const totalBytes = Number.parseInt(response.headers["content-length"] || "0", 10);
        let downloadedBytes = 0;

        response.on("data", (chunk: Buffer) => {
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
      }
    });
  }

  /**
   * Publish a new release to GitHub
   */
  async publishRelease(
    manifest: PatchManifest,
    patchArchive: Buffer,
    options: PublishOptions = {}
  ): Promise<GitHubRelease> {
    try {
      const tagName = this.formatTagName(manifest.version, options.channel);

      logger.info(`[GitHub] Creating release ${tagName}...`);

      // Create GitHub release
      const releaseResponse = await this.octokit.repos.createRelease({
        owner: this.owner,
        repo: this.repo,
        tag_name: tagName,
        name: `ARUS ${manifest.version}`,
        body: this.formatReleaseBody(manifest),
        draft: options.draft || false,
        prerelease: options.prerelease || manifest.severity === "critical",
      });

      const release = releaseResponse.data;
      logger.info(`[GitHub] Release created: ${release.html_url}`);

      // Upload patch archive
      const patchFileName = `patch-${manifest.version}.tar.gz`;
      logger.info(`[GitHub] Uploading ${patchFileName}...`);

      await this.octokit.repos.uploadReleaseAsset({
        owner: this.owner,
        repo: this.repo,
        release_id: release.id,
        name: patchFileName,
        data: cast<string>(patchArchive),
      });

      // Upload manifest.json
      logger.info("[GitHub] Uploading manifest.json...");
      await this.octokit.repos.uploadReleaseAsset({
        owner: this.owner,
        repo: this.repo,
        release_id: release.id,
        name: "manifest.json",
        data: JSON.stringify(manifest, null, 2),
      });

      // Upload checksums.txt
      const checksums = this.generateChecksumsFile(manifest);
      logger.info("[GitHub] Uploading checksums.txt...");

      await this.octokit.repos.uploadReleaseAsset({
        owner: this.owner,
        repo: this.repo,
        release_id: release.id,
        name: "checksums.txt",
        data: checksums,
      });

      logger.info(`[GitHub] ✅ Release published successfully: ${release.html_url}`);

      return release as GitHubRelease;
    } catch (error) {
      logger.error("[GitHub] Error publishing release:", undefined, error);
      throw error;
    }
  }

  /**
   * List all releases, optionally filtered by channel
   */
  async listReleases(channel?: string): Promise<GitHubRelease[]> {
    try {
      const response = await this.octokit.repos.listReleases({
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
      });

      let releases = response.data as GitHubRelease[];

      // Filter by channel if specified
      if (channel) {
        releases = releases.filter((r) => {
          const tag = r.tag_name.toLowerCase();
          return tag.includes(channel.toLowerCase());
        });
      }

      return releases;
    } catch (error) {
      logger.error("[GitHub] Error listing releases:", undefined, error);
      return [];
    }
  }

  /**
   * Get a specific release by version
   */
  async getRelease(version: string): Promise<GitHubRelease | null> {
    try {
      const tagName = this.formatTagName(version);

      const response = await this.octokit.repos.getReleaseByTag({
        owner: this.owner,
        repo: this.repo,
        tag: tagName,
      });

      return response.data as GitHubRelease;
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }
      logger.error("[GitHub] Error fetching release:", undefined, error);
      throw error;
    }
  }

  /**
   * Fetch JSON content from a URL
   */
  private async fetchAssetContent<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (response) => {
          // Handle redirects
          if (response.statusCode === 302 || response.statusCode === 301) {
            if (response.headers.location) {
              https.get(response.headers.location, handleResponse);
            } else {
              reject(new Error("Redirect without location"));
            }
            return;
          }

          handleResponse(response);
        })
        .on("error", reject);

      function handleResponse(response: any) {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        let data = "";
        response.on("data", (chunk: string) => {
          data += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Invalid JSON"));
          }
        });
      }
    });
  }

  /**
   * Extract version number from tag name (e.g., "v1.0.1-stable" -> "1.0.1")
   */
  private extractVersion(tagName: string): string {
    return tagName.replace(new RegExp(`^${this.channelTagPrefix}`), "").replace(/-[^-]*$/, "");
  }

  /**
   * Format tag name with prefix and channel
   */
  private formatTagName(version: string, channel?: string): string {
    let tag = `${this.channelTagPrefix}${version}`;
    if (channel && channel !== "stable") {
      tag += `-${channel}`;
    }
    return tag;
  }

  /**
   * Compare two semantic versions
   */
  private isNewerVersion(version: string, currentVersion: string): boolean {
    const v1Parts = version.split(".").map(Number);
    const v2Parts = currentVersion.split(".").map(Number);

    for (let i = 0; i < 3; i++) {
      const v1 = v1Parts[i] ?? 0;
      const v2 = v2Parts[i] ?? 0;

      if (v1 > v2) {
        return true;
      }
      if (v1 < v2) {
        return false;
      }
    }

    return false; // Equal versions
  }

  /**
   * Format release body with manifest information
   */
  private formatReleaseBody(manifest: PatchManifest): string {
    const lines = [
      `## ARUS ${manifest.version}`,
      "",
      `**Severity:** ${manifest.severity.toUpperCase()}`,
      `**Type:** ${manifest.patchType}`,
      `**From Version:** ${manifest.fromVersion}`,
      `**Requires Restart:** ${manifest.requiresRestart ? "Yes" : "No"}`,
      "",
      "### Release Notes",
      manifest.releaseNotes || "No release notes provided.",
      "",
      "### Changes",
      `- ${manifest.changes.length} file(s) modified`,
      `- Total size: ${(manifest.fileSize / 1024 / 1024).toFixed(2)} MB`,
      "",
    ];

    if (manifest.migrations && manifest.migrations.length > 0) {
      lines.push("### Database Migrations");
      manifest.migrations.forEach((m) => {
        lines.push(`- ${m.description} (${m.type})`);
      });
      lines.push("");
    }

    lines.push(
      "---",
      `📦 Download the patch from the assets below.`,
      `🔒 SHA256: \`${manifest.checksumSha256}\``
    );

    return lines.join("\n");
  }

  /**
   * Generate checksums file content
   */
  private generateChecksumsFile(manifest: PatchManifest): string {
    const lines = [
      "# SHA256 Checksums",
      `# Generated: ${new Date().toISOString()}`,
      "",
      `${manifest.checksumSha256}  patch-${manifest.version}.tar.gz`,
      "",
      "# Verify with:",
      `# sha256sum -c checksums.txt`,
    ];

    return lines.join("\n");
  }
}
