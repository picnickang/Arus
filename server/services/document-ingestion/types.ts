export interface DocumentMetadata {
  pageCount?: number;
  fileSize?: number;
  processingTimeMs?: number;
  ocrUsed?: boolean;
  summary?: string;
  summaryTokens?: number;
  keywords?: string[];
  tableCount?: number;
  structuredDataExtracted?: boolean;
  [key: string]: unknown;
}

export type SupportedFileType = "pdf" | "png" | "jpg" | "jpeg" | "docx" | "xlsx" | "txt" | "md";

export interface IngestDocumentParams {
  orgId: string;
  fileName: string;
  fileBuffer: Buffer;
  fileType: SupportedFileType;
  documentId?: string | undefined;
  uploadedBy?: string | undefined;
  equipmentId?: string | undefined;
  openAiKey?: string | undefined;
}

export interface IngestDocumentResult {
  docId: string;
  chunksCreated: number;
  metadata: DocumentMetadata;
}

export interface TextExtractor {
  extract(buffer: Buffer): Promise<string>;
  supportedTypes: SupportedFileType[];
}

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}
