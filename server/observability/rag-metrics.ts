import client from "prom-client";

// ===== RAG PIPELINE METRICS =====

// Document upload metrics
export const kbDocumentsUploadedTotal = new client.Counter({
  name: "arus_kb_documents_uploaded_total",
  help: "Total knowledge base documents uploaded",
  labelNames: ["org_id", "file_type", "status"],
});

export const kbUploadBytesTotal = new client.Counter({
  name: "arus_kb_upload_bytes_total",
  help: "Total bytes uploaded for knowledge base documents",
  labelNames: ["org_id", "file_type"],
});

export const kbUploadInflight = new client.Gauge({
  name: "arus_kb_upload_inflight",
  help: "Number of knowledge base uploads currently in progress",
  labelNames: ["org_id"],
});

// Embedding processing metrics
export const kbEmbeddingDuration = new client.Histogram({
  name: "arus_kb_embedding_duration_seconds",
  help: "Time to generate embeddings for document chunks",
  labelNames: ["org_id", "model_type"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

export const kbChunksProcessedTotal = new client.Counter({
  name: "arus_kb_chunks_processed_total",
  help: "Total document chunks processed for embeddings",
  labelNames: ["org_id", "model_type", "status"],
});

// Search performance metrics
export const kbSearchDuration = new client.Histogram({
  name: "arus_kb_search_duration_seconds",
  help: "Knowledge base semantic search latency",
  labelNames: ["org_id"],
  buckets: [0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5],
});

export const kbSearchTotal = new client.Counter({
  name: "arus_kb_search_total",
  help: "Total knowledge base searches performed",
  labelNames: ["org_id", "search_mode"],
});

export const kbSearchResultsCount = new client.Histogram({
  name: "arus_kb_search_results_count",
  help: "Number of results returned per search",
  labelNames: ["org_id"],
  buckets: [1, 5, 10, 20, 50, 100],
});

// Embedding cache metrics
export const kbEmbeddingCacheHitsTotal = new client.Counter({
  name: "arus_kb_embedding_cache_hits_total",
  help: "Total embedding cache hits (reused embeddings)",
  labelNames: ["org_id"],
});

export const kbEmbeddingCacheMissesTotal = new client.Counter({
  name: "arus_kb_embedding_cache_misses_total",
  help: "Total embedding cache misses (new embeddings generated)",
  labelNames: ["org_id"],
});

export const kbEmbeddingCacheSize = new client.Gauge({
  name: "arus_kb_embedding_cache_size",
  help: "Number of embeddings stored in cache",
  labelNames: ["org_id"],
});

// Vector index metrics
export const kbVectorIndexBuildDuration = new client.Histogram({
  name: "arus_kb_vector_index_build_duration_seconds",
  help: "Time to build vector index",
  labelNames: ["index_type"],
  buckets: [1, 5, 15, 30, 60, 120, 300, 600],
});

export const kbVectorIndexRebuildTotal = new client.Counter({
  name: "arus_kb_vector_index_rebuild_total",
  help: "Total vector index rebuild operations",
  labelNames: ["index_type", "result"],
});

export const kbVectorIndexLastLatency = new client.Gauge({
  name: "arus_kb_vector_index_last_latency_ms",
  help: "Most recent vector index benchmark latency in milliseconds",
  labelNames: ["index_type"],
});

export const kbVectorIndexRowCount = new client.Gauge({
  name: "arus_kb_vector_index_row_count",
  help: "Number of embeddings indexed",
});

// Helper functions
export function recordKbDocumentUpload(
  orgId: string,
  fileType: string,
  status: "completed" | "failed" | "processing"
) {
  kbDocumentsUploadedTotal.inc({ org_id: orgId, file_type: fileType, status });
}

export function recordKbUploadBytes(orgId: string, fileType: string, bytes: number) {
  kbUploadBytesTotal.inc({ org_id: orgId, file_type: fileType }, bytes);
}

export function setKbUploadInflight(orgId: string, count: number) {
  kbUploadInflight.set({ org_id: orgId }, count);
}

export function recordKbEmbeddingDuration(orgId: string, modelType: string, durationSec: number) {
  kbEmbeddingDuration.observe({ org_id: orgId, model_type: modelType }, durationSec);
}

export function recordKbChunkProcessed(
  orgId: string,
  modelType: string,
  status: "success" | "error"
) {
  kbChunksProcessedTotal.inc({ org_id: orgId, model_type: modelType, status });
}

export function recordKbSearchDuration(orgId: string, durationSec: number) {
  kbSearchDuration.observe({ org_id: orgId }, durationSec);
}

export function recordKbSearch(orgId: string, searchMode: "semantic" | "hybrid") {
  kbSearchTotal.inc({ org_id: orgId, search_mode: searchMode });
}

export function recordKbSearchResults(orgId: string, count: number) {
  kbSearchResultsCount.observe({ org_id: orgId }, count);
}

export function recordKbEmbeddingCacheHit(orgId: string) {
  kbEmbeddingCacheHitsTotal.inc({ org_id: orgId });
}

export function recordKbEmbeddingCacheMiss(orgId: string) {
  kbEmbeddingCacheMissesTotal.inc({ org_id: orgId });
}

export function setKbEmbeddingCacheSize(orgId: string, size: number) {
  kbEmbeddingCacheSize.set({ org_id: orgId }, size);
}

export function recordKbVectorIndexBuild(indexType: string, durationSec: number) {
  kbVectorIndexBuildDuration.observe({ index_type: indexType }, durationSec);
}

export function recordKbVectorIndexRebuild(indexType: string, result: "success" | "error") {
  kbVectorIndexRebuildTotal.inc({ index_type: indexType, result });
}

export function setKbVectorIndexLatency(indexType: string, latencyMs: number) {
  kbVectorIndexLastLatency.set({ index_type: indexType }, latencyMs);
}

export function setKbVectorIndexRowCount(count: number) {
  kbVectorIndexRowCount.set(count);
}

export function incrementKbDocumentsUploaded(
  orgId: string,
  fileType: string,
  status: "completed" | "failed" | "processing"
) {
  kbDocumentsUploadedTotal.inc({ org_id: orgId, file_type: fileType, status });
}

export function incrementKbUploadBytes(orgId: string, fileType: string, bytes: number) {
  kbUploadBytesTotal.inc({ org_id: orgId, file_type: fileType }, bytes);
}

export function incrementKbUploadInflight(orgId: string) {
  kbUploadInflight.inc({ org_id: orgId });
}

export function decrementKbUploadInflight(orgId: string) {
  kbUploadInflight.dec({ org_id: orgId });
}
