/**
 * Patch Applicator — archive safety & hashing helpers
 *
 * Self-contained, instance-free helpers extracted from patch-applicator.ts to
 * keep that file under the source-size ratchet. These functions hold the
 * security-sensitive tar-slip pre-scan (`assertSafeArchive`) and file-hash
 * verification (`verifyFileHash`); their logic is unchanged from the original.
 *
 * Security (S2076): callers still drive extraction via runTrustedExecutable.
 */

import * as fs from "node:fs";
import path from "node:path";
import * as tar from "tar";
import crypto from "node:crypto";

/**
 * Tar entry types that are safe to extract to disk. Everything else —
 * symlinks, hardlinks, device nodes, FIFOs and exotic GNU types — is rejected
 * during the pre-extraction scan. Symlink/hardlink entries are the classic
 * tar-slip primitive for writing outside the extraction directory.
 */
export const ALLOWED_TAR_ENTRY_TYPES: ReadonlySet<string> = new Set([
  "File",
  "OldFile",
  "ContiguousFile",
  "Directory",
]);

/**
 * Scan a tar.gz archive and throw if any entry is unsafe to extract: a
 * disallowed type (symlink, hardlink, device, FIFO, …), an absolute path, or
 * a path that escapes `extractDir` (e.g. `../../etc/cron.d/x`). Violations are
 * collected so the error names the offending entries.
 */
export async function assertSafeArchive(patchPath: string, extractDir: string): Promise<void> {
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
export async function verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
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
