import { extractText } from "./extractors";
import { chunkText } from "./chunker";
import { embedChunks } from "./embedder";
import { summarizeDocument, generateKeywords } from "./summarizer";
import * as repository from "./repository";
import type { IngestDocumentParams, IngestDocumentResult, DocumentMetadata } from "./types";
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:DocumentIngestion:Index");
import {
  incrementKbDocumentsUploaded,
  incrementKbUploadBytes,
  incrementKbUploadInflight,
  decrementKbUploadInflight,
} from "../../observability";
import { semanticChunker } from "../rag/chunking/semantic-chunker";
import { getRagSecurityServices } from "../rag/security";

export interface FileValidationOptions {
  skipValidation?: boolean;
}

export async function ingestDocument(
  params: IngestDocumentParams,
  options: FileValidationOptions = {}
): Promise<IngestDocumentResult> {
  const { orgId, fileName, fileBuffer, fileType, documentId, uploadedBy, equipmentId, openAiKey } =
    params;
  const startTime = Date.now();

  // File validation (security hardening)
  if (!options.skipValidation) {
    try {
      const { fileValidator, auditLogger } = getRagSecurityServices();
      const mimeType = getMimeTypeFromExtension(fileType);
      const validation = await fileValidator.validate(fileName, fileBuffer, mimeType);

      if (!validation.valid) {
        auditLogger.logFileValidationFailure({
          userId: uploadedBy,
          orgId,
          filename: fileName,
          errors: validation.errors,
          warnings: validation.warnings,
          quarantined: validation.quarantine,
        });
        throw new Error(`File validation failed: ${validation.errors.join("; ")}`);
      }

      if (validation.warnings.length > 0) {
        logger.warn(
          `[DocIngestion] Validation warnings for ${fileName}: ${validation.warnings.join("; ")}`
        );
      }

      if (validation.quarantine) {
        logger.warn(`[DocIngestion] File ${fileName} quarantined for review`);
        throw new Error("File quarantined for security review");
      }

      // Log successful upload
      auditLogger.logDocumentUpload({
        userId: uploadedBy,
        orgId,
        filename: fileName,
        fileSize: fileBuffer.length,
        mimeType,
        success: true,
      });
    } catch (validationError: unknown) {
      const vmsg =
        validationError instanceof Error ? validationError.message : String(validationError);
      if (vmsg.includes("File validation failed") || vmsg.includes("quarantined")) {
        throw validationError;
      }
      // If security services aren't initialized, continue without validation in dev
      if (process.env["NODE_ENV"] === "development") {
        logger.warn(`[DocIngestion] Skipping file validation (security services not available)`);
      } else {
        throw new Error("File validation unavailable");
      }
    }
  }

  incrementKbUploadInflight(orgId);
  logger.info(`[DocIngestion] Starting: ${fileName} (${fileType}, ${fileBuffer.length} bytes)`);

  try {
    const metadata: DocumentMetadata = { fileSize: fileBuffer.length };

    const extractedText = await extractText(fileBuffer, fileType);
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text could be extracted from the document");
    }

    if (["png", "jpg", "jpeg"].includes(fileType)) {
      metadata.ocrUsed = true;
    }

    logger.info(`[DocIngestion] Extracted ${extractedText.length} characters`);

    // Use semantic chunking for better context preservation
    // Falls back to basic chunking if semantic chunking fails
    let textChunks: string[];
    try {
      const semanticChunks = semanticChunker.chunk(extractedText);
      if (semanticChunks.length > 0) {
        textChunks = semanticChunks.map((c) => c.content);
        metadata["chunkingMethod"] = "semantic";
        logger.info(`[DocIngestion] Created ${textChunks.length} semantic chunks`);
      } else {
        textChunks = chunkText(extractedText);
        metadata["chunkingMethod"] = "basic";
        logger.info(`[DocIngestion] Created ${textChunks.length} basic chunks`);
      }
    } catch (chunkError) {
      logger.warn(`[DocIngestion] Semantic chunking failed, using basic: ${chunkError}`);
      textChunks = chunkText(extractedText);
      metadata["chunkingMethod"] = "basic";
      logger.info(`[DocIngestion] Created ${textChunks.length} basic chunks (fallback)`);
    }

    let doc;
    if (documentId) {
      doc = await repository.updateDocumentForProcessing({
        documentId,
        orgId,
        fileType,
        sizeBytes: fileBuffer.length,
        numChunks: textChunks.length,
        metadata,
      });
      logger.info(`[DocIngestion] Updated existing document: ${doc.id}`);
    } else {
      doc = await repository.createDocument({
        orgId,
        fileName,
        fileType,
        sizeBytes: fileBuffer.length,
        numChunks: textChunks.length,
        metadata,
        uploadedBy,
        equipmentId,
      });
      await repository.recordDocumentCreation(
        doc.id,
        uploadedBy || null,
        fileBuffer.length,
        textChunks.length
      );
      logger.info(`[DocIngestion] Created document: ${doc.id}`);
    }

    const chunksWithEmbeddings = await embedChunks(textChunks, { openAiKey, orgId });
    await repository.insertChunks(doc.id, chunksWithEmbeddings);

    const summarizationResult = await summarizeDocument(extractedText, { openAiKey });
    if (summarizationResult) {
      metadata.summary = summarizationResult.summary;
      metadata.summaryTokens =
        summarizationResult.tokenCount.prompt + summarizationResult.tokenCount.completion;

      const keywords = await generateKeywords(extractedText, 10);
      if (keywords.length > 0) {
        metadata.keywords = keywords;
      }
      logger.info(
        `[DocIngestion] Generated summary (${summarizationResult.summary.length} chars) and ${keywords.length} keywords`
      );
    }

    const processingTimeMs = Date.now() - startTime;
    metadata.processingTimeMs = processingTimeMs;

    if (documentId) {
      await repository.markDocumentCompleted(doc.id, orgId, metadata);
    } else {
      await repository.updateDocumentMetadata(doc.id, metadata);
    }

    logger.info(`[DocIngestion] Completed in ${processingTimeMs}ms`);
    incrementKbDocumentsUploaded(orgId, fileType, "completed");
    incrementKbUploadBytes(orgId, fileType, fileBuffer.length);

    return { docId: doc.id, chunksCreated: textChunks.length, metadata };
  } catch (error) {
    incrementKbDocumentsUploaded(orgId, fileType, "failed");
    throw error;
  } finally {
    decrementKbUploadInflight(orgId);
  }
}

/**
 * Helper to get MIME type from file extension
 */
function getMimeTypeFromExtension(ext: string): string | undefined {
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  return mimeMap[ext.toLowerCase().replace(".", "")];
}

export { repository };
export const documentRepository = repository;
export { chunkText, chunkByParagraph } from "./chunker";
export { embedChunks } from "./embedder";
export { extractText, getExtractor, getSupportedTypes } from "./extractors";
export { summarizeDocument, generateKeywords } from "./summarizer";
export * from "./types";
