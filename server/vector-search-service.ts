// LR-3.5 / V2 (ML-2): vector search stub.
//
// The functions below are STUBS — they always return an empty result
// set. They predate the consolidation of vector retrieval into
// `server/services/rag/*` and are kept only as a typed shim for the
// handful of legacy callers (`server/routes/kb-routes.ts`,
// `server/routes/rag-routes.ts`, `server/routes/kb-ask-route.ts`,
// `server/report-context/knowledge-citations.ts`) that still import
// them. Because they return [], they cannot leak cross-tenant data
// by construction.
//
// The ONE real pgvector nearest-neighbour query in the codebase lives
// in `server/services/rag/semantic-cache.ts` (search for
// `query_embedding <=> ${embeddingStr}::vector`). That query already
// applies `WHERE org_id = ${orgId}` INSIDE the SQL — i.e. the org-id
// pre-filter and the ordering+LIMIT are evaluated by Postgres in the
// same statement, so the top-K is taken from the org-scoped subset,
// never from the global set. That's the pre-filter contract V2
// requires; see the marker in semantic-cache.ts.
//
// Forward-safety contract for any future real implementation of the
// functions below: the caller MUST pass an `orgId` and the SQL MUST
// place `org_id = $orgId` in the WHERE clause of the same SELECT
// that performs the `<->` / `<#>` / `<=>` nearest-neighbour scan.
// Applying the org filter AFTER an unscoped top-K is the bug V2
// guards against — it would let an attacker with an embedding tuned
// to another tenant's documents push their own org's matches out of
// the top-K and observe zero results as a leak channel.
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
