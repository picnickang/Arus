import fs from "fs";
import type { KnowledgeBasePort } from "../domain/ports";

const DOC_MIME_TYPES = [
  "application/pdf",
  "text/csv",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

const MIME_TO_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "text/csv": "txt",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

const DOC_EXTENSION_RE = /\.(pdf|docx|xlsx|txt|md|csv)$/i;

export interface KBIngestableFile {
  path: string;
  filename: string;
  mimetype: string;
}

export interface KBIngestionResult {
  filename: string;
  chunkCount: number;
}

export function isKBIngestibleFile(mimetype: string, filename: string): boolean {
  return (DOC_MIME_TYPES as readonly string[]).includes(mimetype) ||
    DOC_EXTENSION_RE.test(filename);
}

export function resolveFileType(mimetype: string, filename: string): string {
  if (MIME_TO_TYPE[mimetype]) return MIME_TO_TYPE[mimetype];
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext || "txt";
}

export async function ingestFilesToKB(
  kb: KnowledgeBasePort,
  orgId: string,
  files: KBIngestableFile[],
  uploadedBy?: string,
): Promise<KBIngestionResult[]> {
  const results: KBIngestionResult[] = [];

  for (const file of files) {
    if (!isKBIngestibleFile(file.mimetype, file.filename)) continue;

    try {
      const fileBuffer = fs.readFileSync(file.path);
      const fileType = resolveFileType(file.mimetype, file.filename);
      const result = await kb.ingestDocument(orgId, file.filename, fileBuffer, fileType, uploadedBy);
      results.push({ filename: file.filename, chunkCount: result.chunkCount });
    } catch (err) {
      console.warn(
        `[KBIngestion] Ingestion failed for ${file.filename}:`,
        err instanceof Error ? err.message : "unknown",
      );
    }
  }

  return results;
}

export function buildIngestionSystemMessage(ingested: KBIngestionResult[]): string {
  const summary = ingested.map(f => `• "${f.filename}" — ${f.chunkCount} chunks indexed`).join("\n");
  return `[Knowledge Base] ${ingested.length} document(s) automatically ingested into the Knowledge Base:\n${summary}\nThese documents are now searchable via the searchKnowledgeBase tool.`;
}
