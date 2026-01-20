/**
 * RAG Conversation Cleanup Scheduled Job
 * 
 * Periodically cleans up:
 * - Expired semantic cache entries
 * - Inactive conversations older than retention period
 * - Orphaned messages without parent conversations
 */

import { db } from '../../db';
import { ragSemanticCache, ragConversations, ragMessages } from '@shared/schema';
import { lt, and, isNull, notInArray, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { ragMetrics } from './metrics';

export interface CleanupConfig {
  cacheMaxAgeHours?: number;
  conversationMaxAgeDays?: number;
  inactiveConversationDays?: number;
  batchSize?: number;
}

const DEFAULT_CONFIG: Required<CleanupConfig> = {
  cacheMaxAgeHours: 24,
  conversationMaxAgeDays: 90,
  inactiveConversationDays: 30,
  batchSize: 100,
};

export interface CleanupResult {
  expiredCacheEntries: number;
  inactiveConversations: number;
  orphanedMessages: number;
  durationMs: number;
}

export async function runCleanup(
  orgId: string,
  config: CleanupConfig = {}
): Promise<CleanupResult> {
  const startTime = Date.now();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  logger.info(`[RAG Cleanup] Starting cleanup for org: ${orgId}`);
  
  let expiredCacheEntries = 0;
  let inactiveConversations = 0;
  let orphanedMessages = 0;

  try {
    expiredCacheEntries = await cleanupExpiredCache(orgId, mergedConfig);
    inactiveConversations = await cleanupInactiveConversations(orgId, mergedConfig);
    orphanedMessages = await cleanupOrphanedMessages(orgId);
    
    const durationMs = Date.now() - startTime;
    
    logger.info(`[RAG Cleanup] Completed in ${durationMs}ms: ` +
      `cache=${expiredCacheEntries}, conversations=${inactiveConversations}, orphans=${orphanedMessages}`);
    
    return {
      expiredCacheEntries,
      inactiveConversations,
      orphanedMessages,
      durationMs,
    };
  } catch (error) {
    logger.error('[RAG Cleanup] Failed:', error);
    ragMetrics.recordError('cleanup_failed', 'cleanup');
    throw error;
  }
}

async function cleanupExpiredCache(
  orgId: string,
  config: Required<CleanupConfig>
): Promise<number> {
  const now = new Date();
  
  const result = await db
    .delete(ragSemanticCache)
    .where(
      and(
        sql`${ragSemanticCache.orgId} = ${orgId}`,
        sql`${ragSemanticCache.expiresAt} IS NOT NULL`,
        lt(ragSemanticCache.expiresAt, now)
      )
    )
    .returning({ id: ragSemanticCache.id });

  const cacheAgeThreshold = new Date(now.getTime() - config.cacheMaxAgeHours * 60 * 60 * 1000);
  
  const oldEntries = await db
    .delete(ragSemanticCache)
    .where(
      and(
        sql`${ragSemanticCache.orgId} = ${orgId}`,
        isNull(ragSemanticCache.expiresAt),
        lt(ragSemanticCache.createdAt, cacheAgeThreshold)
      )
    )
    .returning({ id: ragSemanticCache.id });

  const totalDeleted = result.length + oldEntries.length;
  
  if (totalDeleted > 0) {
    logger.debug(`[RAG Cleanup] Deleted ${totalDeleted} expired cache entries`);
  }
  
  return totalDeleted;
}

async function cleanupInactiveConversations(
  orgId: string,
  config: Required<CleanupConfig>
): Promise<number> {
  const inactiveThreshold = new Date();
  inactiveThreshold.setDate(inactiveThreshold.getDate() - config.inactiveConversationDays);
  
  const maxAgeThreshold = new Date();
  maxAgeThreshold.setDate(maxAgeThreshold.getDate() - config.conversationMaxAgeDays);

  const inactiveConversations = await db
    .select({ id: ragConversations.id })
    .from(ragConversations)
    .where(
      and(
        sql`${ragConversations.orgId} = ${orgId}`,
        sql`${ragConversations.isActive} = false`,
        lt(ragConversations.updatedAt, inactiveThreshold)
      )
    )
    .limit(config.batchSize);

  const oldConversations = await db
    .select({ id: ragConversations.id })
    .from(ragConversations)
    .where(
      and(
        sql`${ragConversations.orgId} = ${orgId}`,
        lt(ragConversations.createdAt, maxAgeThreshold)
      )
    )
    .limit(config.batchSize);

  const conversationIds = [
    ...new Set([
      ...inactiveConversations.map(c => c.id),
      ...oldConversations.map(c => c.id),
    ])
  ];

  if (conversationIds.length === 0) {
    return 0;
  }

  await db
    .delete(ragMessages)
    .where(sql`${ragMessages.conversationId} IN (${sql.raw(conversationIds.map(id => `'${id}'`).join(','))})`);

  const result = await db
    .delete(ragConversations)
    .where(sql`${ragConversations.id} IN (${sql.raw(conversationIds.map(id => `'${id}'`).join(','))})`)
    .returning({ id: ragConversations.id });

  if (result.length > 0) {
    logger.debug(`[RAG Cleanup] Deleted ${result.length} inactive conversations`);
  }

  return result.length;
}

async function cleanupOrphanedMessages(orgId: string): Promise<number> {
  const validConversationIds = await db
    .select({ id: ragConversations.id })
    .from(ragConversations)
    .where(sql`${ragConversations.orgId} = ${orgId}`);

  const validIds = validConversationIds.map(c => c.id);

  if (validIds.length === 0) {
    const result = await db
      .delete(ragMessages)
      .where(sql`${ragMessages.orgId} = ${orgId}`)
      .returning({ id: ragMessages.id });
    return result.length;
  }

  const orphaned = await db
    .delete(ragMessages)
    .where(
      and(
        sql`${ragMessages.orgId} = ${orgId}`,
        notInArray(ragMessages.conversationId, validIds)
      )
    )
    .returning({ id: ragMessages.id });

  if (orphaned.length > 0) {
    logger.debug(`[RAG Cleanup] Deleted ${orphaned.length} orphaned messages`);
  }

  return orphaned.length;
}

export class RagCleanupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private config: Required<CleanupConfig>;

  constructor(config: CleanupConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(intervalMs: number = 60 * 60 * 1000): void {
    if (this.intervalId) {
      this.stop();
    }

    logger.info(`[RAG Cleanup] Scheduler started, interval: ${intervalMs}ms`);

    this.intervalId = setInterval(async () => {
      try {
        await runCleanup('default-org-id', this.config);
      } catch (error) {
        logger.error('[RAG Cleanup] Scheduled cleanup failed:', error);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[RAG Cleanup] Scheduler stopped');
    }
  }

  async runNow(orgId: string = 'default-org-id'): Promise<CleanupResult> {
    return runCleanup(orgId, this.config);
  }
}

export const ragCleanupScheduler = new RagCleanupScheduler();
