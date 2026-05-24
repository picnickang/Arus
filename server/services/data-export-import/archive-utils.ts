/**
 * Archive Utilities
 *
 * Functions for creating and extracting tar.gz archives
 * with path traversal, symlink, and expansion-size protection.
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:DataExportImport:ArchiveUtils");
import * as fs from "node:fs";
import * as path from "node:path";
import { createWriteStream } from "node:fs";
import archiver from "archiver";

const DEFAULT_MAX_EXTRACTED_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

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

function isWithinDirectory(candidatePath: string, basePath: string): boolean {
  const relative = path.relative(basePath, candidatePath);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function maxExtractedBytes(): number {
  const configured = Number.parseInt(process.env.MAX_IMPORT_EXTRACTED_BYTES ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_EXTRACTED_BYTES;
}

/**
 * Extract a tar.gz archive with path traversal, symlink, and zip-bomb protection.
 */
export async function extractArchive(archivePath: string, extractPath: string): Promise<void> {
  const extract = await import("tar");

  fs.mkdirSync(extractPath, { recursive: true });

  const normalizedExtractPath = path.resolve(extractPath);
  let extractedBytes = 0;
  const maxBytes = maxExtractedBytes();

  await extract.extract({
    file: archivePath,
    cwd: extractPath,
    preservePaths: false,
    strict: true,
    filter: (entryPath, entry) => {
      const e = entry as unknown as { type?: string; size?: number };
      const resolvedPath = path.resolve(extractPath, entryPath);
      if (!isWithinDirectory(resolvedPath, normalizedExtractPath)) {
        logger.error(`[DataImport] Path traversal attempt blocked: ${entryPath}`);
        return false;
      }

      if (e?.type === "SymbolicLink" || e?.type === "Link") {
        logger.error(`[DataImport] Link entry blocked: ${entryPath}`);
        return false;
      }

      const size = Number(e?.size ?? 0);
      if (Number.isFinite(size) && size > 0) {
        extractedBytes += size;
        if (extractedBytes > maxBytes) {
          throw new Error(`Import archive expands beyond configured limit (${maxBytes} bytes)`);
        }
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
  return isWithinDirectory(resolvedPath, normalizedExtractPath);
}
