import path from "path";
import fs from "fs";
import { db } from "../../../db";
import { eq, and } from "drizzle-orm";
import { agentFiles } from "@shared/schema/agent";

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

const UPLOAD_BASE_DIR = "/tmp/agent-uploads";

export function getOrgUploadDir(orgId: string): string {
  const safe = orgId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = path.join(UPLOAD_BASE_DIR, safe);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function registerFile(
  orgId: string,
  conversationId: string,
  multerFile: { originalname: string; mimetype: string; size: number; path: string },
): Promise<FileRecord> {
  const [record] = await db.insert(agentFiles).values({
    orgId,
    conversationId,
    filename: multerFile.originalname,
    mimetype: multerFile.mimetype,
    size: multerFile.size,
    storedPath: multerFile.path,
  }).returning();
  return record;
}

export async function resolveFile(fileId: string, orgId: string): Promise<FileRecord | null> {
  const [record] = await db.select().from(agentFiles)
    .where(and(eq(agentFiles.id, fileId), eq(agentFiles.orgId, orgId)));
  if (!record) return null;
  if (!fs.existsSync(record.storedPath)) return null;
  const resolved = path.resolve(record.storedPath);
  const orgDir = path.resolve(getOrgUploadDir(orgId));
  if (!resolved.startsWith(orgDir)) return null;
  return record;
}

export async function listConversationFiles(conversationId: string, orgId: string): Promise<FileRecord[]> {
  return db.select().from(agentFiles)
    .where(and(eq(agentFiles.conversationId, conversationId), eq(agentFiles.orgId, orgId)));
}

export async function deleteFile(fileId: string, orgId: string): Promise<boolean> {
  const record = await resolveFile(fileId, orgId);
  if (!record) return false;
  try { fs.unlinkSync(record.storedPath); } catch {}
  await db.delete(agentFiles).where(and(eq(agentFiles.id, fileId), eq(agentFiles.orgId, orgId)));
  return true;
}

if (!fs.existsSync(UPLOAD_BASE_DIR)) fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
