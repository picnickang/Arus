/**
 * Backup Utilities - Helper functions for backup/recovery operations
 */

import { createHash } from "node:crypto";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { isVesselMode, hasPostgresFeatures } from "../config/runtimeEnv";

export function generateBackupId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = crypto.randomUUID().slice(0, 6);
  return `${timestamp}-${random}`;
}

export function determineRetentionType(timestamp: Date): "daily" | "weekly" | "monthly" {
  const dayOfWeek = timestamp.getDay();
  const dayOfMonth = timestamp.getDate();

  if (dayOfMonth === 1) {
    return "monthly";
  }

  if (dayOfWeek === 0) {
    return "weekly";
  }

  return "daily";
}

export async function getDatabaseVersion(): Promise<string> {
  if (isVesselMode || !hasPostgresFeatures) {
    return "SQLite (vessel mode)";
  }

  try {
    const result = await db.execute(sql`SELECT version();`);
    return (result.rows[0] as any).version;
  } catch (_error) {
    return "unknown";
  }
}

export async function calculateFileChecksum(filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = require("node:fs").createReadStream(filepath);

    stream.on("error", reject);
    stream.on("data", (chunk: Buffer) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export function formatBytes(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) { return "0 Bytes"; }
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100  } ${  sizes[i]}`;
}
