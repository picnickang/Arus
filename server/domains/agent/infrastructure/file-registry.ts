import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Infrastructure:FileRegistry");
import path from "path";
import fs from "fs";
import { db } from "../../../db";
import { eq, and } from "drizzle-orm";
import { agentFiles } from "@shared/schema/agent";
import { withGeneratedInsertDefaults } from "./generated-id";

export interface FileRecord {
  id: string;
  orgId: string;
  conversationId: string;
  filename: string;
  mimetype: string;
  size: number;
  storedPath: string;
  createdAt: Date | null;
}

/**
 * Use an application-owned directory instead of /tmp for upload storage.
 * Falls back to /tmp/agent-uploads only if .data is not writable.
 */
const UPLOAD_BASE_DIR = (() => {
  const preferred = path.join(process.cwd(), ".data", "agent-uploads");
  try {
    fs.mkdirSync(preferred, { recursive: true, mode: 0o700 });
    return preferred;
  } catch {
    const fallback = "/tmp/agent-uploads";
    logger.warn(`[FileRegistry] Could not create ${preferred}, falling back to ${fallback}`);
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
})();

/**
 * Returns the org-scoped upload directory, creating it if necessary.
 * The orgId is sanitised to prevent directory traversal.
 */
export function getOrgUploadDir(orgId: string): string {
  // Strip everything except alphanumeric, dash, underscore
  const safe = orgId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe || safe === "." || safe === "..") {
    throw new Error("Invalid orgId for file storage");
  }
  const dir = path.join(UPLOAD_BASE_DIR, safe);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

export async function registerFile(
  orgId: string,
  conversationId: string,
  multerFile: { originalname: string; mimetype: string; size: number; path: string }
): Promise<FileRecord> {
  const [record] = await db
    .insert(agentFiles)
    .values(
      withGeneratedInsertDefaults(
        {
          orgId,
          conversationId,
          filename: multerFile.originalname,
          mimetype: multerFile.mimetype,
          size: multerFile.size,
          storedPath: multerFile.path,
        },
        ["createdAt"]
      )
    )
    .returning();
  if (!record) {
    throw new Error("Failed to register agent file");
  }
  return record;
}

/**
 * Resolve a file record by ID, with org-scoping and path-traversal protection.
 * Returns null if the file does not exist, belongs to a different org, or the
 * stored path escapes the org upload directory.
 */
export async function resolveFile(fileId: string, orgId: string): Promise<FileRecord | null> {
  const [record] = await db
    .select()
    .from(agentFiles)
    .where(and(eq(agentFiles.id, fileId), eq(agentFiles.orgId, orgId)));
  if (!record) {
    return null;
  }

  // Verify the physical file still exists
  if (!fs.existsSync(record.storedPath)) {
    return null;
  }

  // Path-traversal guard: resolved path must be under the org's upload dir
  // or under the base upload dir (for cross-org safety).
  const resolved = path.resolve(record.storedPath);
  const baseDir = path.resolve(UPLOAD_BASE_DIR);
  const orgDir = path.resolve(getOrgUploadDir(orgId));

  if (!resolved.startsWith(orgDir + path.sep) && !resolved.startsWith(orgDir)) {
    // Also allow exact match on orgDir itself (unlikely but safe)
    if (resolved !== orgDir) {
      logger.warn(`[FileRegistry] Path traversal blocked: ${resolved} is not under ${orgDir}`);
      return null;
    }
  }

  return record;
}

export async function listConversationFiles(
  conversationId: string,
  orgId: string
): Promise<FileRecord[]> {
  return db
    .select()
    .from(agentFiles)
    .where(and(eq(agentFiles.conversationId, conversationId), eq(agentFiles.orgId, orgId)));
}

export async function deleteFile(fileId: string, orgId: string): Promise<boolean> {
  const record = await resolveFile(fileId, orgId);
  if (!record) {
    return false;
  }
  try {
    fs.unlinkSync(record.storedPath);
  } catch {
    // File may already be gone
  }
  await db.delete(agentFiles).where(and(eq(agentFiles.id, fileId), eq(agentFiles.orgId, orgId)));
  return true;
}
