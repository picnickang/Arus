/**
 * RAG Semantic Cache Service
 *
 * Caches RAG responses using semantic similarity for query matching.
 * Features:
 * - Exact hash-based cache lookup (fast path)
 * - Vector similarity-based cache lookup (semantic match)
 * - TTL-based expiration
 * - Cache hit statistics
 */

import crypto from "crypto";
import { db } from "../../db";
import { sql, eq, and, gt, lt } from "drizzle-orm";
import { ragSemanticCache } from "@shared/schema-runtime";
import { generateEmbedding } from "../../embedding-service";
import type { Citation, SemanticCacheEntry } from "./types";
import { logger } from "../../utils/logger";

const DEFAULT_TTL_SECONDS = 3600;
const SEMANTIC_SIMILARITY_THRESHOLD = 0.95;

export interface SemanticCacheConfig {
  enabled?: boolean;
  ttlSeconds?: number;
  semanticThreshold?: number;
  useSemanticLookup?: boolean;
}

export class SemanticCache {
  private enabled: boolean;
  private ttlSeconds: number;
  private semanticThreshold: number;
  private useSemanticLookup: boolean;

  constructor(config: SemanticCacheConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.ttlSeconds = config.ttlSeconds || DEFAULT_TTL_SECONDS;
    this.semanticThreshold = config.semanticThreshold || SEMANTIC_SIMILARITY_THRESHOLD;
    this.useSemanticLookup = config.useSemanticLookup ?? true;
  }

  private hashQuery(query: string, orgId: string): string {
    const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
    return crypto.createHash("sha256").update(`${orgId}:${normalized}`).digest("hex");
  }

  async get(orgId: string, query: string): Promise<SemanticCacheEntry | null> {
    if (!this.enabled) {
      return null;
    }

    const queryHash = this.hashQuery(query, orgId);

    const exactMatch = await db
      .select()
      .from(ragSemanticCache)
      .where(
        and(
          eq(ragSemanticCache.orgId, orgId),
          eq(ragSemanticCache.queryHash, queryHash),
          gt(ragSemanticCache.expiresAt, new Date())
        )
      )
      .limit(1);

    if (exactMatch.length > 0) {
      const entry = exactMatch[0];

      await db
        .update(ragSemanticCache)
        .set({
          hitCount: sql`hit_count + 1`,
          lastAccessedAt: new Date(),
        })
        .where(eq(ragSemanticCache.id, entry.id));

      logger.info(`[SemanticCache] Exact cache hit for query hash ${queryHash.substring(0, 8)}`);

      return this.toEntry(entry);
    }

    if (this.useSemanticLookup) {
      return this.semanticLookup(orgId, query);
    }

    return null;
  }

  private async semanticLookup(orgId: string, query: string): Promise<SemanticCacheEntry | null> {
    try {
      const queryEmbedding = await generateEmbedding(query, { orgId });
      const embeddingStr = `[${queryEmbedding.join(",")}]`;
      const distanceThreshold = 1 - this.semanticThreshold;

      const results = await db.execute<{
        id: string;
        query_hash: string;
        query_text: string;
        response: string;
        source_chunk_ids: string[] | null;
        citations: any;
        model_used: string | null;
        hit_count: number;
        created_at: Date;
        expires_at: Date | null;
        distance: number;
      }>(sql`
        SELECT 
          id, query_hash, query_text, response, source_chunk_ids, 
          citations, model_used, hit_count, created_at, expires_at,
          query_embedding <=> ${embeddingStr}::vector as distance
        FROM rag_semantic_cache
        WHERE org_id = ${orgId}
          AND expires_at > NOW()
          AND query_embedding IS NOT NULL
          AND query_embedding <=> ${embeddingStr}::vector <= ${distanceThreshold}
        ORDER BY query_embedding <=> ${embeddingStr}::vector ASC
        LIMIT 1
      `);

      if (results.rows.length > 0) {
        const entry = results.rows[0];

        await db
          .update(ragSemanticCache)
          .set({
            hitCount: sql`hit_count + 1`,
            lastAccessedAt: new Date(),
          })
          .where(eq(ragSemanticCache.id, entry.id));

        logger.info(`[SemanticCache] Semantic cache hit (distance: ${entry.distance.toFixed(4)})`);

        return {
          queryHash: entry.query_hash,
          queryText: entry.query_text,
          response: entry.response,
          citations: (entry.citations as Citation[]) || [],
          sourceChunkIds: entry.source_chunk_ids || [],
          modelUsed: entry.model_used || "unknown",
          hitCount: entry.hit_count,
          createdAt: entry.created_at,
          expiresAt: entry.expires_at || undefined,
        };
      }
    } catch (error) {
      logger.error("[SemanticCache] Semantic lookup failed:", error);
    }

    return null;
  }

  async set(params: {
    orgId: string;
    query: string;
    response: string;
    citations: Citation[];
    sourceChunkIds: string[];
    modelUsed: string;
    ttlSeconds?: number;
  }): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const queryHash = this.hashQuery(params.query, params.orgId);
    const ttl = params.ttlSeconds || this.ttlSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    let queryEmbedding: number[] | null = null;
    if (this.useSemanticLookup) {
      try {
        queryEmbedding = await generateEmbedding(params.query, { orgId: params.orgId });
      } catch (error) {
        logger.warn("[SemanticCache] Failed to generate query embedding:", error);
      }
    }

    try {
      await db
        .insert(ragSemanticCache)
        .values({
          orgId: params.orgId,
          queryHash,
          queryText: params.query,
          queryEmbedding: queryEmbedding ? sql`${JSON.stringify(queryEmbedding)}::vector` : null,
          response: params.response,
          sourceChunkIds: params.sourceChunkIds,
          citations: params.citations,
          modelUsed: params.modelUsed,
          ttlSeconds: ttl,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [ragSemanticCache.orgId, ragSemanticCache.queryHash],
          set: {
            response: params.response,
            citations: params.citations,
            sourceChunkIds: params.sourceChunkIds,
            modelUsed: params.modelUsed,
            queryEmbedding: queryEmbedding ? sql`${JSON.stringify(queryEmbedding)}::vector` : null,
            expiresAt,
            lastAccessedAt: new Date(),
          },
        });

      logger.info(`[SemanticCache] Cached response for query hash ${queryHash.substring(0, 8)}`);
    } catch (error) {
      logger.error("[SemanticCache] Failed to cache response:", error);
    }
  }

  async invalidate(orgId: string, query?: string): Promise<number> {
    if (query) {
      const queryHash = this.hashQuery(query, orgId);
      const result = await db
        .delete(ragSemanticCache)
        .where(and(eq(ragSemanticCache.orgId, orgId), eq(ragSemanticCache.queryHash, queryHash)))
        .returning({ id: ragSemanticCache.id });
      return result.length;
    }

    const result = await db
      .delete(ragSemanticCache)
      .where(eq(ragSemanticCache.orgId, orgId))
      .returning({ id: ragSemanticCache.id });
    return result.length;
  }

  async cleanup(): Promise<number> {
    const result = await db
      .delete(ragSemanticCache)
      .where(lt(ragSemanticCache.expiresAt, new Date()))
      .returning({ id: ragSemanticCache.id });

    if (result.length > 0) {
      logger.info(`[SemanticCache] Cleaned up ${result.length} expired entries`);
    }

    return result.length;
  }

  async getStats(orgId: string): Promise<{
    totalEntries: number;
    totalHits: number;
    avgHitCount: number;
  }> {
    const stats = await db.execute<{
      total_entries: string;
      total_hits: string;
      avg_hits: string;
    }>(sql`
      SELECT 
        COUNT(*) as total_entries,
        COALESCE(SUM(hit_count), 0) as total_hits,
        COALESCE(AVG(hit_count), 0) as avg_hits
      FROM rag_semantic_cache
      WHERE org_id = ${orgId}
        AND expires_at > NOW()
    `);

    const row = stats.rows[0];
    return {
      totalEntries: parseInt(row?.total_entries || "0", 10),
      totalHits: parseInt(row?.total_hits || "0", 10),
      avgHitCount: parseFloat(row?.avg_hits || "0"),
    };
  }

  private toEntry(row: any): SemanticCacheEntry {
    return {
      queryHash: row.queryHash,
      queryText: row.queryText,
      response: row.response,
      citations: (row.citations as Citation[]) || [],
      sourceChunkIds: row.sourceChunkIds || [],
      modelUsed: row.modelUsed || "unknown",
      hitCount: row.hitCount,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt || undefined,
    };
  }
}

let defaultInstance: SemanticCache | null = null;

export function getSemanticCache(config?: SemanticCacheConfig): SemanticCache {
  if (!defaultInstance || config) {
    defaultInstance = new SemanticCache(config);
  }
  return defaultInstance;
}
