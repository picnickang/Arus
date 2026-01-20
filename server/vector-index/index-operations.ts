/**
 * Vector Index Operations
 */

import { db } from "@db";
import { sql } from "drizzle-orm";
import { recordKbVectorIndexBuildDuration, incrementKbVectorIndexRebuild } from "../observability";
import type { IndexStats, IndexInfo, IndexConfig } from "./types";
import { TABLE_NAME, IVFFLAT_INDEX_NAME, HNSW_INDEX_NAME } from "./types";

export async function getIndexStats(): Promise<IndexStats> {
  const indexQuery = await db.execute(sql`
    SELECT i.relname as index_name, am.amname as index_type, pg_size_pretty(pg_relation_size(i.oid)) as size, idx.indisvalid as is_valid
    FROM pg_class t
    JOIN pg_index idx ON t.oid = idx.indrelid
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_am am ON i.relam = am.oid
    WHERE t.relname = ${TABLE_NAME} AND am.amname IN ('ivfflat', 'hnsw')
    ORDER BY i.relname
  `);

  const countQuery = await db.execute(sql`SELECT COUNT(*) as count FROM kb_chunks WHERE embedding IS NOT NULL`);
  const rowCount = Number(countQuery.rows[0]?.count || 0);

  const indexes: IndexInfo[] = indexQuery.rows.map(row => ({
    indexName: String(row.index_name),
    indexType: String(row.index_type) as "ivfflat" | "hnsw",
    isValid: Boolean(row.is_valid),
    size: String(row.size),
  }));

  return { tableName: TABLE_NAME, columnName: "embedding", rowCount, indexes, activeIndex: indexes[0] || null };
}

export async function dropAllVectorIndexes(): Promise<void> {
  const stats = await getIndexStats();
  if (stats.indexes.length === 0) {
    console.log("[VectorIndex] No existing vector indexes to drop");
    return;
  }

  console.log(`[VectorIndex] Dropping ${stats.indexes.length} existing vector index(es)...`);
  for (const index of stats.indexes) {
    await db.execute(sql`DROP INDEX IF EXISTS ${sql.raw(index.indexName)}`);
    console.log(`[VectorIndex]   ✓ Dropped ${index.indexName} (${index.indexType})`);
  }
}

function calculateOptimalLists(rowCount: number): number {
  if (rowCount < 100) {return 10;}
  const optimal = Math.floor(Math.sqrt(rowCount));
  return Math.max(10, Math.min(optimal, 1000));
}

export async function createIVFFlatIndex(config?: IndexConfig): Promise<void> {
  const stats = await getIndexStats();
  if (stats.rowCount === 0) {
    console.warn("[VectorIndex] No embeddings found - skipping index creation");
    return;
  }

  await dropAllVectorIndexes();
  const lists = config?.lists || calculateOptimalLists(stats.rowCount);

  console.log(`[VectorIndex] Creating IVFFlat index with ${lists} lists for ${stats.rowCount} rows...`);
  const startTime = Date.now();

  await db.execute(sql`
    CREATE INDEX ${sql.raw(IVFFLAT_INDEX_NAME)} ON kb_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = ${lists})
  `);

  const duration = Date.now() - startTime;
  console.log(`[VectorIndex] ✓ IVFFlat index created in ${duration}ms`);
  recordKbVectorIndexBuildDuration("ivfflat", duration / 1000);
  incrementKbVectorIndexRebuild("ivfflat", "success");

  const probes = Math.max(1, Math.floor(lists / 10));
  await db.execute(sql`SET ivfflat.probes = ${probes}`);
  await db.execute(sql`ANALYZE kb_chunks`);
}

export async function createHNSWIndex(config?: IndexConfig): Promise<void> {
  const stats = await getIndexStats();
  if (stats.rowCount === 0) {
    console.warn("[VectorIndex] No embeddings found - skipping index creation");
    return;
  }

  await dropAllVectorIndexes();
  const m = config?.m || 16;
  const efConstruction = config?.efConstruction || 64;

  console.log(`[VectorIndex] Creating HNSW index (m=${m}, ef_construction=${efConstruction}) for ${stats.rowCount} rows...`);
  const startTime = Date.now();

  await db.execute(sql`
    CREATE INDEX ${sql.raw(HNSW_INDEX_NAME)} ON kb_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = ${m}, ef_construction = ${efConstruction})
  `);

  const duration = Date.now() - startTime;
  console.log(`[VectorIndex] ✓ HNSW index created in ${duration}ms`);
  recordKbVectorIndexBuildDuration("hnsw", duration / 1000);
  incrementKbVectorIndexRebuild("hnsw", "success");

  const efSearch = Math.max(40, Math.floor(efConstruction / 2));
  await db.execute(sql`SET hnsw.ef_search = ${efSearch}`);
  await db.execute(sql`ANALYZE kb_chunks`);
}
