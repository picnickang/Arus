export {
  ingestDocument,
  documentRepository,
  chunkText,
  embedChunks,
  extractText,
  getSupportedTypes,
} from './services/document-ingestion';

export type {
  DocumentMetadata,
  SupportedFileType,
  IngestDocumentParams,
  IngestDocumentResult,
} from './services/document-ingestion';

import { documentRepository } from './services/document-ingestion';

export const deleteDocument = (docId: string, orgId: string) => {
  return documentRepository.deleteDocument(docId, orgId);
};

export const getDocument = (docId: string, orgId: string) => {
  return documentRepository.getDocument(docId, orgId);
};

export const listDocuments = (orgId: string) => {
  return documentRepository.listDocuments(orgId);
};
