import path from "path";
import fs from "fs";
import crypto from "crypto";

export interface FileRecord {
  id: string;
  orgId: string;
  conversationId: string;
  filename: string;
  mimetype: string;
  size: number;
  storedPath: string;
  createdAt: string;
}

const UPLOAD_BASE_DIR = "/tmp/agent-uploads";

const fileStore = new Map<string, FileRecord>();

export function getOrgUploadDir(orgId: string): string {
  const safe = orgId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = path.join(UPLOAD_BASE_DIR, safe);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function registerFile(
  orgId: string,
  conversationId: string,
  multerFile: { originalname: string; mimetype: string; size: number; path: string },
): FileRecord {
  const id = crypto.randomUUID();
  const record: FileRecord = {
    id,
    orgId,
    conversationId,
    filename: multerFile.originalname,
    mimetype: multerFile.mimetype,
    size: multerFile.size,
    storedPath: multerFile.path,
    createdAt: new Date().toISOString(),
  };
  fileStore.set(id, record);
  return record;
}

export function resolveFile(fileId: string, orgId: string): FileRecord | null {
  const record = fileStore.get(fileId);
  if (!record) return null;
  if (record.orgId !== orgId) return null;
  if (!fs.existsSync(record.storedPath)) return null;
  const resolved = path.resolve(record.storedPath);
  const orgDir = path.resolve(getOrgUploadDir(orgId));
  if (!resolved.startsWith(orgDir)) return null;
  return record;
}

export function listConversationFiles(conversationId: string, orgId: string): FileRecord[] {
  const results: FileRecord[] = [];
  for (const record of fileStore.values()) {
    if (record.conversationId === conversationId && record.orgId === orgId) {
      results.push(record);
    }
  }
  return results;
}

export function deleteFile(fileId: string, orgId: string): boolean {
  const record = resolveFile(fileId, orgId);
  if (!record) return false;
  try { fs.unlinkSync(record.storedPath); } catch {}
  fileStore.delete(fileId);
  return true;
}

if (!fs.existsSync(UPLOAD_BASE_DIR)) fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
