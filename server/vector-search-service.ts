// Stub file - vector search consolidated into RAG system
export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
  docName?: string;
  docId?: string;
  chunkId?: string;
  ord?: number;
  similarity?: number;
  text?: string;
}

export async function searchSimilarChunks(_opts: unknown): Promise<SearchResult[]> {
  return [];
}

export async function searchKnowledgeBase(
  _query: string,
  _options?: { limit?: number; threshold?: number }
): Promise<SearchResult[]> {
  return [];
}

export async function getKnowledgeBaseStats(): Promise<{
  totalDocuments: number;
  indexSize: number;
}> {
  return { totalDocuments: 0, indexSize: 0 };
}
