/**
 * RAG Conversation Service
 *
 * Manages multi-turn conversations with context memory.
 * Features:
 * - Conversation CRUD operations
 * - Message history management
 * - Context window management for LLM calls
 * - Conversation summarization for long histories
 */

import { db } from "../../db";
import { sql, eq, and } from "drizzle-orm";
import { ragConversations, ragMessages } from "@shared/schema-runtime";
import type { RagConversation, RagMessage } from "@shared/schema";
import type { ConversationMessage, ConversationContext, Citation } from "./types";
import { logger } from "../../utils/logger";

const MAX_CONTEXT_MESSAGES = 10;
const MAX_CONTEXT_TOKENS = 4000;

export class ConversationService {
  private maxContextMessages: number;
  private maxContextTokens: number;

  constructor(config?: { maxContextMessages?: number; maxContextTokens?: number }) {
    this.maxContextMessages = config?.maxContextMessages || MAX_CONTEXT_MESSAGES;
    this.maxContextTokens = config?.maxContextTokens || MAX_CONTEXT_TOKENS;
  }

  async createConversation(params: {
    orgId: string;
    userId?: string;
    title?: string;
    context?: Record<string, any>;
  }): Promise<RagConversation> {
    const [conversation] = await db
      .insert(ragConversations)
      .values({
        orgId: params.orgId,
        userId: params.userId,
        title: params.title || "New Conversation",
        context: params.context || {},
        messageCount: 0,
        isActive: true,
      })
      .returning();

    logger.info(`[ConversationService] Created conversation ${conversation.id}`);
    return conversation;
  }

  async getConversation(conversationId: string): Promise<RagConversation | null> {
    const conversations = await db
      .select()
      .from(ragConversations)
      .where(eq(ragConversations.id, conversationId))
      .limit(1);

    return conversations[0] || null;
  }

  async listConversations(params: {
    orgId: string;
    userId?: string;
    limit?: number;
    activeOnly?: boolean;
  }): Promise<RagConversation[]> {
    const conditions = [eq(ragConversations.orgId, params.orgId)];

    if (params.userId) {
      conditions.push(eq(ragConversations.userId, params.userId));
    }
    if (params.activeOnly) {
      conditions.push(eq(ragConversations.isActive, true));
    }

    return db
      .select()
      .from(ragConversations)
      .where(and(...conditions))
      .orderBy(sql`${ragConversations.lastMessageAt} DESC`)
      .limit(params.limit || 20);
  }

  async updateConversation(
    conversationId: string,
    updates: Partial<Pick<RagConversation, "title" | "context" | "isActive">>
  ): Promise<RagConversation | null> {
    const [updated] = await db
      .update(ragConversations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(ragConversations.id, conversationId))
      .returning();

    return updated || null;
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    const result = await db
      .delete(ragConversations)
      .where(eq(ragConversations.id, conversationId))
      .returning({ id: ragConversations.id });

    return result.length > 0;
  }

  async addMessage(params: {
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    sourceChunkIds?: string[];
    citations?: Citation[];
    tokenCount?: number;
    modelUsed?: string;
    latencyMs?: number;
  }): Promise<RagMessage> {
    const [message] = await db
      .insert(ragMessages)
      .values({
        conversationId: params.conversationId,
        role: params.role,
        content: params.content,
        sourceChunkIds: params.sourceChunkIds,
        citations: params.citations ? JSON.parse(JSON.stringify(params.citations)) : [],
        tokenCount: params.tokenCount,
        modelUsed: params.modelUsed,
        latencyMs: params.latencyMs,
      })
      .returning();

    await db
      .update(ragConversations)
      .set({
        messageCount: sql`message_count + 1`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ragConversations.id, params.conversationId));

    logger.info(
      `[ConversationService] Added ${params.role} message to conversation ${params.conversationId}`
    );
    return message;
  }

  async getMessages(conversationId: string, limit?: number): Promise<RagMessage[]> {
    return db
      .select()
      .from(ragMessages)
      .where(eq(ragMessages.conversationId, conversationId))
      .orderBy(ragMessages.createdAt)
      .limit(limit || 100);
  }

  async getConversationContext(conversationId: string): Promise<ConversationContext> {
    const messages = await this.getMessages(conversationId, this.maxContextMessages);

    const contextMessages: ConversationMessage[] = [];
    let estimatedTokens = 0;

    for (let i = messages.length - 1; i >= 0 && estimatedTokens < this.maxContextTokens; i--) {
      const msg = messages[i];
      const msgTokens = Math.ceil(msg.content.length / 4);

      if (estimatedTokens + msgTokens <= this.maxContextTokens) {
        contextMessages.unshift({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        });
        estimatedTokens += msgTokens;
      }
    }

    const conversation = await this.getConversation(conversationId);

    return {
      messages: contextMessages,
      metadata: (conversation?.context as Record<string, any>) || {},
    };
  }

  async getOrCreateConversation(params: {
    conversationId?: string;
    orgId: string;
    userId?: string;
    title?: string;
  }): Promise<RagConversation> {
    if (params.conversationId) {
      const existing = await this.getConversation(params.conversationId);
      if (existing) {
        return existing;
      }
    }

    return this.createConversation({
      orgId: params.orgId,
      userId: params.userId,
      title: params.title,
    });
  }

  async generateTitle(conversationId: string): Promise<string> {
    const messages = await this.getMessages(conversationId, 3);
    if (messages.length === 0) {
      return "New Conversation";
    }

    const firstUserMessage = messages.find((m) => m.role === "user");
    if (!firstUserMessage) {
      return "New Conversation";
    }

    const title = firstUserMessage.content.substring(0, 50).trim();
    return title + (firstUserMessage.content.length > 50 ? "..." : "");
  }
}

let defaultInstance: ConversationService | null = null;

export function getConversationService(config?: {
  maxContextMessages?: number;
  maxContextTokens?: number;
}): ConversationService {
  if (!defaultInstance || config) {
    defaultInstance = new ConversationService(config);
  }
  return defaultInstance;
}
