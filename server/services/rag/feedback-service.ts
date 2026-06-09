/**
 * RAG Feedback Service
 *
 * Tracks user feedback on RAG responses for quality improvement.
 * Features:
 * - Feedback collection (helpful, not helpful, inaccurate, etc.)
 * - Aggregated statistics per document/chunk
 * - Re-ranking signals based on feedback
 */

import { db } from "../../db";
import { sql, eq, and } from "drizzle-orm";
import { ragFeedback } from "@shared/schema-runtime";
import type { RagFeedback } from "@shared/schema";
import type { FeedbackInput } from "./types";
import { logger } from "../../utils/logger";
import { randomUUID } from "node:crypto";

export interface FeedbackStats {
  totalFeedback: number;
  helpfulCount: number;
  notHelpfulCount: number;
  inaccurateCount: number;
  averageRating: number | null;
}

export interface ChunkFeedbackStats {
  chunkId: string;
  helpfulCount: number;
  notHelpfulCount: number;
  totalFeedback: number;
  score: number;
}

export class FeedbackService {
  async submitFeedback(input: FeedbackInput): Promise<RagFeedback> {
    const [feedback] = await db
      .insert(ragFeedback)
      .values({
        id: randomUUID(),
        orgId: input.orgId,
        messageId: input.messageId,
        chunkId: input.chunkId,
        userId: input.userId,
        feedbackType: input.feedbackType,
        rating: input.rating,
        comment: input.comment,
        queryText: input.queryText,
        createdAt: new Date(),
      })
      .returning();

    if (!feedback) {
      throw new Error("Failed to record feedback");
    }
    logger.info(`[FeedbackService] Recorded ${input.feedbackType} feedback for org ${input.orgId}`);
    return feedback;
  }

  async getFeedback(params: {
    orgId: string;
    messageId?: string;
    chunkId?: string;
    limit?: number;
  }): Promise<RagFeedback[]> {
    const conditions = [eq(ragFeedback.orgId, params.orgId)];

    if (params.messageId) {
      conditions.push(eq(ragFeedback.messageId, params.messageId));
    }
    if (params.chunkId) {
      conditions.push(eq(ragFeedback.chunkId, params.chunkId));
    }

    return db
      .select()
      .from(ragFeedback)
      .where(and(...conditions))
      .orderBy(sql`${ragFeedback.createdAt} DESC`)
      .limit(params.limit || 100);
  }

  async getOrgStats(orgId: string): Promise<FeedbackStats> {
    const stats = await db.execute<{
      total_feedback: string;
      helpful_count: string;
      not_helpful_count: string;
      inaccurate_count: string;
      avg_rating: string | null;
    }>(sql`
      SELECT 
        COUNT(*) as total_feedback,
        COUNT(*) FILTER (WHERE feedback_type = 'helpful') as helpful_count,
        COUNT(*) FILTER (WHERE feedback_type = 'not_helpful') as not_helpful_count,
        COUNT(*) FILTER (WHERE feedback_type = 'inaccurate') as inaccurate_count,
        AVG(rating) as avg_rating
      FROM rag_feedback
      WHERE org_id = ${orgId}
    `);

    const row = stats.rows[0];
    return {
      totalFeedback: parseInt(row?.total_feedback || "0", 10),
      helpfulCount: parseInt(row?.helpful_count || "0", 10),
      notHelpfulCount: parseInt(row?.not_helpful_count || "0", 10),
      inaccurateCount: parseInt(row?.inaccurate_count || "0", 10),
      averageRating: row?.avg_rating ? parseFloat(row.avg_rating) : null,
    };
  }

  async getChunkFeedbackStats(
    orgId: string,
    chunkIds: string[]
  ): Promise<Map<string, ChunkFeedbackStats>> {
    if (chunkIds.length === 0) {
      return new Map();
    }

    const stats = await db.execute<{
      chunk_id: string;
      helpful_count: string;
      not_helpful_count: string;
      total_feedback: string;
    }>(sql`
      SELECT 
        chunk_id,
        COUNT(*) FILTER (WHERE feedback_type = 'helpful') as helpful_count,
        COUNT(*) FILTER (WHERE feedback_type = 'not_helpful') as not_helpful_count,
        COUNT(*) as total_feedback
      FROM rag_feedback
      WHERE org_id = ${orgId}
        AND chunk_id = ANY(${chunkIds}::text[])
      GROUP BY chunk_id
    `);

    const result = new Map<string, ChunkFeedbackStats>();
    for (const row of stats.rows) {
      const helpful = parseInt(row.helpful_count, 10);
      const notHelpful = parseInt(row.not_helpful_count, 10);
      const total = parseInt(row.total_feedback, 10);

      const score = total > 0 ? (helpful - notHelpful) / total : 0;

      result.set(row.chunk_id, {
        chunkId: row.chunk_id,
        helpfulCount: helpful,
        notHelpfulCount: notHelpful,
        totalFeedback: total,
        score,
      });
    }

    return result;
  }

  async getReRankingBoosts(orgId: string, chunkIds: string[]): Promise<Map<string, number>> {
    const stats = await this.getChunkFeedbackStats(orgId, chunkIds);
    const boosts = new Map<string, number>();

    for (const [chunkId, stat] of stats) {
      const boost = stat.score * 0.1;
      boosts.set(chunkId, boost);
    }

    return boosts;
  }

  async getTopRatedChunks(orgId: string, limit: number = 10): Promise<ChunkFeedbackStats[]> {
    const stats = await db.execute<{
      chunk_id: string;
      helpful_count: string;
      not_helpful_count: string;
      total_feedback: string;
      score: string;
    }>(sql`
      SELECT 
        chunk_id,
        COUNT(*) FILTER (WHERE feedback_type = 'helpful') as helpful_count,
        COUNT(*) FILTER (WHERE feedback_type = 'not_helpful') as not_helpful_count,
        COUNT(*) as total_feedback,
        (COUNT(*) FILTER (WHERE feedback_type = 'helpful') - 
         COUNT(*) FILTER (WHERE feedback_type = 'not_helpful'))::float / 
         NULLIF(COUNT(*), 0) as score
      FROM rag_feedback
      WHERE org_id = ${orgId}
        AND chunk_id IS NOT NULL
      GROUP BY chunk_id
      HAVING COUNT(*) >= 3
      ORDER BY score DESC
      LIMIT ${limit}
    `);

    return stats.rows.map((row) => ({
      chunkId: row.chunk_id,
      helpfulCount: parseInt(row.helpful_count, 10),
      notHelpfulCount: parseInt(row.not_helpful_count, 10),
      totalFeedback: parseInt(row.total_feedback, 10),
      score: parseFloat(row.score),
    }));
  }

  async getLowRatedChunks(orgId: string, limit: number = 10): Promise<ChunkFeedbackStats[]> {
    const stats = await db.execute<{
      chunk_id: string;
      helpful_count: string;
      not_helpful_count: string;
      total_feedback: string;
      score: string;
    }>(sql`
      SELECT 
        chunk_id,
        COUNT(*) FILTER (WHERE feedback_type = 'helpful') as helpful_count,
        COUNT(*) FILTER (WHERE feedback_type = 'not_helpful') as not_helpful_count,
        COUNT(*) as total_feedback,
        (COUNT(*) FILTER (WHERE feedback_type = 'helpful') - 
         COUNT(*) FILTER (WHERE feedback_type = 'not_helpful'))::float / 
         NULLIF(COUNT(*), 0) as score
      FROM rag_feedback
      WHERE org_id = ${orgId}
        AND chunk_id IS NOT NULL
      GROUP BY chunk_id
      HAVING COUNT(*) >= 3
      ORDER BY score ASC
      LIMIT ${limit}
    `);

    return stats.rows.map((row) => ({
      chunkId: row.chunk_id,
      helpfulCount: parseInt(row.helpful_count, 10),
      notHelpfulCount: parseInt(row.not_helpful_count, 10),
      totalFeedback: parseInt(row.total_feedback, 10),
      score: parseFloat(row.score),
    }));
  }
}

let defaultInstance: FeedbackService | null = null;

export function getFeedbackService(): FeedbackService {
  if (!defaultInstance) {
    defaultInstance = new FeedbackService();
  }
  return defaultInstance;
}
