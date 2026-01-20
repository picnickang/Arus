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
  [key: string]: any;
}

export type SupportedFileType = 'pdf' | 'png' | 'jpg' | 'jpeg' | 'docx' | 'xlsx' | 'txt' | 'md';

export interface IngestDocumentParams {
  orgId: string;
  fileName: string;
  fileBuffer: Buffer;
  fileType: SupportedFileType;
  documentId?: string;
  uploadedBy?: string;
  equipmentId?: string;
  openAiKey?: string;
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
