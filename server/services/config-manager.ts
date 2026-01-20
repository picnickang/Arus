/**
 * Configuration Manager Service
 * Handles hot reloading of environment variables and system configuration
 * Part of ARUS 3-Tier Patching System - Tier 1
 */

import * as fs from "node:fs";
import path from "node:path";
import { db } from "../db";
import { configAuditLog } from "../../shared/schema";
import type { InsertConfigAuditLog } from "../../shared/schema";

export interface ConfigChange {
  key: string;
  oldValue: string | undefined;
  newValue: string | undefined;
  requiresRestart: boolean;
}

export interface ReloadResult {
  success: boolean;
  changed: ConfigChange[];
  criticalChanges: ConfigChange[];
  requiresRestart: boolean;
  error?: string;
}

/**
 * Critical environment variables that require application restart
 */
const CRITICAL_ENV_VARS = new Set([
  "DATABASE_URL",
  "PORT",
  "NODE_ENV",
  "SESSION_SECRET",
  "DEPLOYMENT_MODE",
]);

/**
 * ConfigManager handles runtime configuration reloading
 */
export class ConfigManager {
  private config: Map<string, string>;
  private envFilePath: string;
  private watchers: fs.FSWatcher[] = [];

  constructor(envFilePath: string = ".env") {
    this.config = new Map();
    this.envFilePath = path.resolve(process.cwd(), envFilePath);
    this.loadInitialConfig();
  }

  /**
   * Load initial configuration into memory
   */
  private loadInitialConfig(): void {
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        this.config.set(key, value);
      }
    }
  }

  /**
   * Parse .env file contents
   */
  private parseEnvFile(content: string): Map<string, string> {
    const config = new Map<string, string>();
    const lines = content.split("\n");

    for (const line of lines) {
      // Skip comments and empty lines
      if (line.trim().startsWith("#") || line.trim() === "") {
        continue;
      }

      // Parse KEY=VALUE format
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        // Handle ${VARIABLE} substitutions
        value = value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
          return process.env[varName] || "";
        });

        config.set(key, value);
      }
    }

    return config;
  }

  /**
   * Load .env file and return configuration
   */
  private loadEnvFile(): Map<string, string> | null {
    try {
      if (!fs.existsSync(this.envFilePath)) {
        console.warn(`[ConfigManager] .env file not found at ${this.envFilePath}`);
        return null;
      }

      const content = fs.readFileSync(this.envFilePath, "utf-8");
      return this.parseEnvFile(content);
    } catch (error) {
      console.error("[ConfigManager] Error loading .env file:", error);
      return null;
    }
  }

  /**
   * Detect changes between old and new configuration
   */
  private detectChanges(
    oldConfig: Map<string, string>,
    newConfig: Map<string, string>
  ): { safe: ConfigChange[]; critical: ConfigChange[] } {
    const safe: ConfigChange[] = [];
    const critical: ConfigChange[] = [];

    // Check for changed or added keys
    for (const [key, newValue] of newConfig.entries()) {
      const oldValue = oldConfig.get(key);

      if (oldValue !== newValue) {
        const change: ConfigChange = {
          key,
          oldValue,
          newValue,
          requiresRestart: CRITICAL_ENV_VARS.has(key),
        };

        if (CRITICAL_ENV_VARS.has(key)) {
          critical.push(change);
        } else {
          safe.push(change);
        }
      }
    }

    // Check for deleted keys
    for (const [key, oldValue] of oldConfig.entries()) {
      if (!newConfig.has(key)) {
        const change: ConfigChange = {
          key,
          oldValue,
          newValue: undefined,
          requiresRestart: CRITICAL_ENV_VARS.has(key),
        };

        if (CRITICAL_ENV_VARS.has(key)) {
          critical.push(change);
        } else {
          safe.push(change);
        }
      }
    }

    return { safe, critical };
  }

  /**
   * Reload configuration from .env file
   */
  async reloadConfig(auditInfo?: {
    orgId: string;
    changedBy?: string;
    changedByName?: string;
    ipAddress?: string;
    userAgent?: string;
    autoReload?: boolean;
  }): Promise<ReloadResult> {
    try {
      const newConfig = this.loadEnvFile();

      if (!newConfig) {
        return {
          success: false,
          changed: [],
          criticalChanges: [],
          requiresRestart: false,
          error: ".env file not found or could not be loaded",
        };
      }

      const { safe, critical } = this.detectChanges(this.config, newConfig);
      const allChanges = [...safe, ...critical];

      // Apply safe changes immediately
      for (const change of safe) {
        if (change.newValue !== undefined) {
          process.env[change.key] = change.newValue;
          this.config.set(change.key, change.newValue);
        } else {
          delete process.env[change.key];
          this.config.delete(change.key);
        }
      }

      // Log all changes to audit log if database is available
      if (auditInfo && allChanges.length > 0) {
        try {
          const auditEntries: InsertConfigAuditLog[] = allChanges.map((change) => ({
            orgId: auditInfo.orgId,
            key: change.key,
            oldValue: change.oldValue,
            newValue: change.newValue,
            changeType:
              change.newValue === undefined
                ? "delete"
                : change.oldValue === undefined
                  ? "create"
                  : "update",
            changedBy: auditInfo.changedBy,
            changedByName: auditInfo.changedByName,
            ipAddress: auditInfo.ipAddress,
            userAgent: auditInfo.userAgent,
            autoReload: auditInfo.autoReload || false,
            requiresRestart: change.requiresRestart,
          }));

          await db.insert(configAuditLog).values(auditEntries);
        } catch (dbError) {
          console.error("[ConfigManager] Failed to log changes to audit log:", dbError);
          // Continue anyway - don't fail reload due to audit log error
        }
      }

      console.log(
        `[ConfigManager] Configuration reloaded: ${safe.length} safe changes, ${critical.length} critical changes`
      );

      return {
        success: true,
        changed: allChanges,
        criticalChanges: critical,
        requiresRestart: critical.length > 0,
      };
    } catch (error) {
      console.error("[ConfigManager] Error reloading configuration:", error);
      return {
        success: false,
        changed: [],
        criticalChanges: [],
        requiresRestart: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Watch .env file for changes and auto-reload
   */
  watchForChanges(auditInfo?: { orgId: string; changedBy?: string; changedByName?: string }): void {
    if (!fs.existsSync(this.envFilePath)) {
      console.warn(`[ConfigManager] Cannot watch non-existent file: ${this.envFilePath}`);
      return;
    }

    const watcher = fs.watch(this.envFilePath, async (eventType) => {
      if (eventType === "change") {
        console.log("[ConfigManager] .env file changed, auto-reloading...");

        const result = await this.reloadConfig({
          ...auditInfo,
          autoReload: true,
          orgId: auditInfo?.orgId || "default-org-id",
        });

        if (result.success) {
          console.log(`[ConfigManager] Auto-reload complete: ${result.changed.length} changes`);
          if (result.requiresRestart) {
            console.warn(
              "[ConfigManager] ⚠️  Critical changes detected! Application restart recommended."
            );
          }
        }
      }
    });

    this.watchers.push(watcher);
    console.log(`[ConfigManager] Watching ${this.envFilePath} for changes`);
  }

  /**
   * Stop watching for file changes
   */
  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    console.log("[ConfigManager] Stopped watching for config changes");
  }

  /**
   * Get current configuration value
   */
  get(key: string): string | undefined {
    return this.config.get(key) || process.env[key];
  }

  /**
   * Get all configuration as object
   */
  getAll(): Record<string, string> {
    const config: Record<string, string> = {};
    for (const [key, value] of this.config.entries()) {
      config[key] = value;
    }
    return config;
  }

  /**
   * Check if a key is a critical environment variable
   */
  isCritical(key: string): boolean {
    return CRITICAL_ENV_VARS.has(key);
  }

  /**
   * Update a single configuration value and save to .env
   */
  async set(
    key: string,
    value: string,
    auditInfo: {
      orgId: string;
      changedBy?: string;
      changedByName?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<ReloadResult> {
    try {
      // Read current .env file
      let envContent = "";
      if (fs.existsSync(this.envFilePath)) {
        envContent = fs.readFileSync(this.envFilePath, "utf-8");
      }

      const oldValue = this.config.get(key);

      // Update or add the key=value pair
      const lines = envContent.split("\n");
      let found = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith(`${key}=`)) {
          // Preserve quotes if value has spaces
          const quotedValue = value.includes(" ") ? `"${value}"` : value;
          lines[i] = `${key}=${quotedValue}`;
          found = true;
          break;
        }
      }

      if (!found) {
        // Add new key at the end
        const quotedValue = value.includes(" ") ? `"${value}"` : value;
        lines.push(`${key}=${quotedValue}`);
      }

      // Write updated .env file
      fs.writeFileSync(this.envFilePath, lines.join("\n"), "utf-8");

      // Reload configuration
      return this.reloadConfig(auditInfo);
    } catch (error) {
      console.error(`[ConfigManager] Error setting ${key}:`, error);
      return {
        success: false,
        changed: [],
        criticalChanges: [],
        requiresRestart: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Delete a configuration value from .env
   */
  async delete(
    key: string,
    auditInfo: {
      orgId: string;
      changedBy?: string;
      changedByName?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<ReloadResult> {
    try {
      if (!fs.existsSync(this.envFilePath)) {
        return {
          success: false,
          changed: [],
          criticalChanges: [],
          requiresRestart: false,
          error: ".env file not found",
        };
      }

      // Read current .env file
      const envContent = fs.readFileSync(this.envFilePath, "utf-8");
      const lines = envContent.split("\n");

      // Remove the line with this key
      const filteredLines = lines.filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith(`${key}=`);
      });

      // Write updated .env file
      fs.writeFileSync(this.envFilePath, filteredLines.join("\n"), "utf-8");

      // Reload configuration
      return this.reloadConfig(auditInfo);
    } catch (error) {
      console.error(`[ConfigManager] Error deleting ${key}:`, error);
      return {
        success: false,
        changed: [],
        criticalChanges: [],
        requiresRestart: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Singleton instance
export const configManager = new ConfigManager();

// Auto-watch for changes in development mode
if (process.env.NODE_ENV === "development") {
  configManager.watchForChanges({
    orgId: "default-org-id",
    changedByName: "System (File Watcher)",
  });
}
