/**
 * Archive Utilities
 *
 * Functions for creating and extracting tar.gz archives
 * with path traversal protection.
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:DataExportImport:ArchiveUtils");
import * as fs from "node:fs";
import * as path from "node:path";
import { createWriteStream } from "node:fs";
import archiver from "archiver";

/**
 * Create a tar.gz archive from a directory
 */
export async function createArchive(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("tar", { gzip: true, gzipOptions: { level: 6 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/**
 * Extract a tar.gz archive with path traversal protection
 */
export async function extractArchive(archivePath: string, extractPath: string): Promise<void> {
  const extract = await import("tar");

  fs.mkdirSync(extractPath, { recursive: true });

  const normalizedExtractPath = path.resolve(extractPath);

  await extract.extract({
    file: archivePath,
    cwd: extractPath,
    filter: (entryPath: string) => {
      const resolvedPath = path.resolve(extractPath, entryPath);
      if (!resolvedPath.startsWith(normalizedExtractPath)) {
        logger.error(`[DataImport] Path traversal attempt blocked: ${entryPath}`);
        return false;
      }
      return true;
    },
  });
}

/**
 * Validate file path is within extraction directory (defense-in-depth)
 */
export function validateFilePath(filePath: string, extractPath: string): boolean {
  const normalizedExtractPath = path.resolve(extractPath);
  const resolvedPath = path.resolve(filePath);
  return resolvedPath.startsWith(normalizedExtractPath);
}
