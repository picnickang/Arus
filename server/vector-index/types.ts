/**
 * Vector Index Service Types
 */

export interface IndexInfo {
  indexName: string;
  indexType: "ivfflat" | "hnsw";
  isValid: boolean;
  size: string;
}

export interface IndexStats {
  tableName: string;
  columnName: string;
  rowCount: number;
  indexes: IndexInfo[];
  activeIndex: IndexInfo | null;
}

export interface BenchmarkResult {
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  samplesRun: number;
  indexType: string;
  timestamp: Date;
  meetsTarget: boolean;
}

export interface IndexConfig {
  lists?: number;
  m?: number;
  efConstruction?: number;
}

export const TABLE_NAME = "kb_chunks";
export const COLUMN_NAME = "embedding";
export const IVFFLAT_INDEX_NAME = "kb_chunks_embedding_ivfflat_idx";
export const HNSW_INDEX_NAME = "kb_chunks_embedding_hnsw_idx";
