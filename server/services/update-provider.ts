/**
 * Update Distribution Provider Interface
 * Abstracts update fetching and publishing to support multiple backends
 * (GitHub Releases, custom update servers, etc.)
 */

export interface PatchManifest {
  version: string;
  fromVersion: string;
  severity: "critical" | "high" | "medium" | "low";
  patchType: "config" | "incremental" | "full";
  requiresRestart: boolean;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  fileSize: number;
  checksumSha256: string;
  signature?: string;
  changes: FileChange[];
  migrations?: DatabaseMigration[];
}

export interface FileChange {
  path: string;
  action: "create" | "update" | "delete" | "merge";
  url: string;
  hash: string;
  size: number;
}

export interface DatabaseMigration {
  type: "sql" | "script";
  file: string;
  description: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: GitHubAsset[];
}

export interface GitHubAsset {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
}

export interface PublishPatchRequest {
  version: string;
  fromVersion: string;
  severity: "critical" | "high" | "medium" | "low";
  patchType: "config" | "incremental" | "full";
  requiresRestart: boolean;
  releaseNotes: string;
  autoDetectChanges?: boolean;
  manualFiles?: Express.Multer.File[];
  channel?: string;
}

export interface PatchPreview {
  version: string;
  fromVersion: string;
  changes: FileChange[];
  totalSize: number;
  fileCount: number;
  estimatedDownloadTime: string;
}

/**
 * Abstract interface for update distribution providers
 */
export interface IUpdateDistributionProvider {
  /**
   * Fetch the latest patch manifest for a given version and channel
   */
  fetchLatestManifest(currentVersion: string, channel: string): Promise<PatchManifest | null>;

  /**
   * Download a patch asset to local filesystem
   */
  downloadAsset(
    url: string,
    destination: string,
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<void>;

  /**
   * Publish a new release with patch files
   */
  publishRelease(
    manifest: PatchManifest,
    patchArchive: Buffer,
    options?: PublishOptions
  ): Promise<GitHubRelease>;

  /**
   * List all available releases
   */
  listReleases(channel?: string): Promise<GitHubRelease[]>;

  /**
   * Get a specific release by version
   */
  getRelease(version: string): Promise<GitHubRelease | null>;
}

export interface PublishOptions {
  draft?: boolean;
  prerelease?: boolean;
  channel?: string;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  type: "github" | "custom";

  // GitHub-specific config
  github?: {
    owner: string;
    repo: string;
    token: string;
    channelTagPrefix?: string; // e.g., 'v' for v1.0.1-stable
  };

  // Custom server config
  custom?: {
    updateServerUrl: string;
    apiKey?: string;
  };
}

/**
 * Factory for creating update providers
 */
export async function createUpdateProvider(
  config: ProviderConfig
): Promise<IUpdateDistributionProvider> {
  if (config.type === "github" && config.github) {
    const { GitHubReleaseProvider } = await import("./github-release-service.js");
    return new GitHubReleaseProvider(config.github);
  }

  if (config.type === "custom" && config.custom) {
    // Legacy HTTP provider would be implemented here if needed
    throw new Error("Legacy HTTP provider not yet implemented");
  }

  throw new Error(`Unsupported provider type: ${config.type}`);
}

/**
 * Get provider configuration from environment
 */
export function getProviderConfigFromEnv(): ProviderConfig {
  const providerType = process.env['UPDATE_PROVIDER'] || "github";

  if (providerType === "github") {
    return {
      type: "github",
      github: {
        owner: process.env['GITHUB_OWNER'] || process.env['GITHUB_UPDATES_OWNER'] || "",
        repo: process.env['GITHUB_REPO'] || process.env['GITHUB_UPDATES_REPO'] || "ARUS-Updates",
        token: process.env['GITHUB_TOKEN'] || "",
        channelTagPrefix: process.env['GITHUB_RELEASE_CHANNEL_TAG_PREFIX'] || "v",
      },
    };
  }

  return {
    type: "custom",
    custom: {
      updateServerUrl: process.env['UPDATE_SERVER_URL'] || "https://updates.arus.io",
      apiKey: process.env['UPDATE_SERVER_API_KEY'],
    },
  };
}
