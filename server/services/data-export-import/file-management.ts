/**
 * File Management
 *
 * Functions for listing and managing export files.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExportListItem } from "./types";

/**
 * List available exports in the export directory
 */
export function listExports(exportDir: string): ExportListItem[] {
  const files = fs.readdirSync(exportDir);
  const exports: ExportListItem[] = [];

  for (const file of files) {
    if (file.endsWith(".tar.gz")) {
      const filePath = path.join(exportDir, file);
      const stats = fs.statSync(filePath);
      exports.push({
        id: file.replace(".tar.gz", ""),
        path: filePath,
        createdAt: stats.birthtime,
        size: stats.size,
      });
    }
  }

  return exports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Delete an export by ID
 */
export function deleteExport(exportDir: string, exportId: string): boolean {
  const filePath = path.join(exportDir, `${exportId}.tar.gz`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Ensure export directory exists
 */
export function ensureExportDir(exportDir: string): string {
  const resolvedPath = path.resolve(process.cwd(), exportDir);
  if (!fs.existsSync(resolvedPath)) {
    fs.mkdirSync(resolvedPath, { recursive: true });
  }
  return resolvedPath;
}
