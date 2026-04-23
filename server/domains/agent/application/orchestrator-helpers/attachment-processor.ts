import fs from "fs";
import type OpenAI from "openai";
import type { KnowledgeBasePort } from "../../domain/ports";
import type { FileAttachment } from "../../domain/types";
import { registerFile, listConversationFiles } from "../../infrastructure/file-registry";
import { ingestFilesToKB } from "../../infrastructure/kb-ingestion-helper";
import { createLogger } from "../../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Application:OrchestratorHelpers:AttachmentProcessor");

export interface ProcessedAttachments {
  contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[];
  displayContent: string;
  kbIngested: Array<{ filename: string; chunkCount: number }>;
}

/**
 * Convert raw uploaded attachments into multimodal content parts:
 *   - images → base64 data URLs
 *   - PDFs   → extracted text via pdf-parse
 *   - CSVs   → parsed summary + first 20 rows
 *   - text   → first 10k chars
 *
 * Side effects: persists each file to the file registry, and (when a
 * KnowledgeBase port is provided) ingests document-type files into KB.
 */
export async function processAttachments(
  conversationId: string,
  orgId: string,
  userId: string | undefined,
  sanitizedMessage: string,
  attachments: FileAttachment[],
  knowledgeBase?: KnowledgeBasePort
): Promise<ProcessedAttachments> {
  const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: sanitizedMessage },
  ];
  const fileDescriptions: string[] = [];

  for (const att of attachments) {
    if (att.mimetype.startsWith("image/")) {
      const base64 = fs.readFileSync(att.path, "base64");
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${att.mimetype};base64,${base64}`, detail: "auto" },
      });
      fileDescriptions.push(`[Image: ${att.filename}]`);
    } else if (att.mimetype === "application/pdf") {
      try {
        const pdfBuffer = fs.readFileSync(att.path);
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(pdfBuffer);
        const text = pdfData.text.slice(0, 12000);
        contentParts.push({
          type: "text",
          text: `\n\n--- PDF: ${att.filename} (${pdfData.numpages} pages) ---\n${text}\n--- End of PDF ---`,
        });
        fileDescriptions.push(`[PDF: ${att.filename}, ${pdfData.numpages} pages]`);
      } catch (err) {
        logger.warn(`[Agent] Failed to parse PDF ${att.filename}:`, { details: err instanceof Error ? err.message : "unknown" });
        fileDescriptions.push(`[PDF: ${att.filename} (could not extract text)]`);
      }
    } else if (att.mimetype === "text/csv" || att.filename.endsWith(".csv")) {
      try {
        const csvText = fs.readFileSync(att.path, "utf-8");
        const Papa = (await import("papaparse")).default;
        const parsed = Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });
        const rows = parsed.data as Record<string, unknown>[];
        const headers = parsed.meta.fields || [];
        const rowCount = rows.length;

        const numericCols = headers.filter((h) => rows.some((r) => typeof r[h] === "number"));
        const stats: string[] = [`Rows: ${rowCount}`, `Columns: ${headers.join(", ")}`];
        for (const col of numericCols.slice(0, 10)) {
          const vals = rows.map((r) => r[col]).filter((v): v is number => typeof v === "number");
          if (vals.length > 0) {
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            stats.push(
              `  ${col}: min=${min}, max=${max}, avg=${avg.toFixed(2)}, count=${vals.length}`
            );
          }
        }

        const preview = csvText.split("\n").slice(0, 21).join("\n");
        contentParts.push({
          type: "text",
          text: `\n\n--- CSV: ${att.filename} ---\nSummary:\n${stats.join("\n")}\n\nFirst 20 rows:\n${preview}\n--- End of CSV ---`,
        });
        fileDescriptions.push(`[CSV: ${att.filename}, ${rowCount} rows]`);
      } catch (err) {
        logger.warn(`[Agent] Failed to parse CSV ${att.filename}:`, { details: err instanceof Error ? err.message : "unknown" });
        const fallback = fs.readFileSync(att.path, "utf-8").slice(0, 10000);
        contentParts.push({
          type: "text",
          text: `\n\n--- Attached file: ${att.filename} ---\n${fallback}\n--- End of file ---`,
        });
        fileDescriptions.push(`[File: ${att.filename}]`);
      }
    } else {
      try {
        const textContent = fs.readFileSync(att.path, "utf-8").slice(0, 10000);
        contentParts.push({
          type: "text",
          text: `\n\n--- Attached file: ${att.filename} ---\n${textContent}\n--- End of file ---`,
        });
        fileDescriptions.push(`[File: ${att.filename}]`);
      } catch (err) {
        logger.warn(`[Agent] Failed to read attachment ${att.filename}:`, { details: err instanceof Error ? err.message : "unknown" });
        fileDescriptions.push(`[File: ${att.filename} (could not read)]`);
      }
    }
  }

  // Register files in DB
  for (const att of attachments) {
    await registerFile(orgId, conversationId, {
      originalname: att.filename,
      mimetype: att.mimetype,
      size: att.size,
      path: att.path,
    });
  }

  // Ingest document-type files into KB
  const kbIngested: Array<{ filename: string; chunkCount: number }> = [];
  if (knowledgeBase) {
    const results = await ingestFilesToKB(
      knowledgeBase,
      orgId,
      attachments.map((att) => ({
        path: att.path,
        filename: att.filename,
        mimetype: att.mimetype,
      })),
      userId
    );
    for (const r of results) {
      kbIngested.push(r);
      fileDescriptions.push(`[KB: "${r.filename}" ingested — ${r.chunkCount} chunks indexed]`);
    }
  }

  // Append available-files context from DB to content parts
  const convFiles = await listConversationFiles(conversationId, orgId);
  if (convFiles.length > 0) {
    const fileRefContext = convFiles
      .map((f) => `- fileId: "${f.id}" | ${f.filename} (${f.mimetype}, ${f.size} bytes)`)
      .join("\n");
    contentParts.push({
      type: "text",
      text: `\n\n--- Available files for this conversation ---\n${fileRefContext}\nYou can use analyzeImage or analyzeSpreadsheet tools with these fileIds.\n--- End of file list ---`,
    });
  }

  const displayContent = `${sanitizedMessage}${fileDescriptions.length > 0 ? `\n${fileDescriptions.join(" ")}` : ""}`;

  return { contentParts, displayContent, kbIngested };
}
