/**
 * RAG Streaming Service
 * Handles Server-Sent Events (SSE) for progressive response delivery.
 *
 * Routes through the LLM Gateway, which encapsulates model fallback,
 * retries, and cost telemetry. Callers see normalised `LLMStreamChunk`
 * deltas regardless of provider.
 */

import { Response } from "express";
import { llmGateway } from "../../../composition/llm-gateway";
import { ragMetrics } from "../metrics";
import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Services:Rag:Streaming:Index");

export interface StreamingConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface StreamingContext {
  query: string;
  relevantChunks: Array<{
    content: string;
    documentId: string;
    documentTitle?: string;
    score: number;
  }>;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface StreamChunk {
  type: "content" | "citation" | "done" | "error";
  content?: string;
  citations?: Array<{
    documentId: string;
    documentTitle: string;
    excerpt: string;
  }>;
  error?: string;
  metadata?: {
    model: string;
    tokensUsed: number;
    latencyMs: number;
  };
}

const DEFAULT_CONFIG: StreamingConfig = {
  model: "gpt-4o",
  temperature: 0.3,
  maxTokens: 2048,
};

export class StreamingService {
  private initialized = false;

  constructor(private config: StreamingConfig = DEFAULT_CONFIG) {}

  async initialize(_apiKey: string): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async streamResponse(
    context: StreamingContext,
    res: Response,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<void> {
    const startTime = Date.now();

    if (!(await llmGateway.isAvailable())) {
      const errorChunk: StreamChunk = {
        type: "error",
        error: "LLM gateway is not available (missing credentials)",
      };
      this.sendSSE(res, errorChunk);
      onChunk?.(errorChunk);
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const systemPrompt = this.buildSystemPrompt(context.relevantChunks);
    const messages = this.buildMessages(systemPrompt, context.query, context.conversationHistory);

    try {
      const stream = llmGateway.chatStream({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        maxCompletionTokens: this.config.maxTokens,
        meta: { caller: "rag-streaming" },
      });

      let tokensUsed = 0;

      for await (const chunk of stream) {
        if (chunk.contentDelta) {
          const contentChunk: StreamChunk = {
            type: "content",
            content: chunk.contentDelta,
          };
          this.sendSSE(res, contentChunk);
          onChunk?.(contentChunk);
        }

        if (chunk.usage) {
          tokensUsed = chunk.usage.totalTokens;
        }
      }

      const citations = this.extractCitations(context.relevantChunks);
      if (citations.length > 0) {
        const citationChunk: StreamChunk = {
          type: "citation",
          citations,
        };
        this.sendSSE(res, citationChunk);
        onChunk?.(citationChunk);
      }

      const latencyMs = Date.now() - startTime;
      const doneChunk: StreamChunk = {
        type: "done",
        metadata: {
          model: this.config.model,
          tokensUsed,
          latencyMs,
        },
      };
      this.sendSSE(res, doneChunk);
      onChunk?.(doneChunk);

      (ragMetrics as any).recordQueryLatency(latencyMs / 1000);

      res.end();
    } catch (error: any) {
      logger.error("[StreamingService] Error during streaming:", undefined, error);

      const errorChunk: StreamChunk = {
        type: "error",
        error: error?.message || "Streaming failed",
      };
      this.sendSSE(res, errorChunk);
      onChunk?.(errorChunk);
      res.end();
    }
  }

  private sendSSE(res: Response, chunk: StreamChunk): void {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  private buildSystemPrompt(chunks: Array<{ content: string; documentTitle?: string }>): string {
    const contextText = chunks
      .map(
        (c, i) => `[Source ${i + 1}${c.documentTitle ? `: ${c.documentTitle}` : ""}]\n${c.content}`
      )
      .join("\n\n---\n\n");

    return `You are a knowledgeable marine maintenance assistant. Answer questions based on the provided documentation. Be concise, accurate, and helpful.

When referencing information, cite the source number in brackets like [Source 1].

Available Documentation:
${contextText}

If the documentation doesn't contain relevant information, say so clearly and provide general guidance if possible.`;
  }

  private buildMessages(
    systemPrompt: string,
    query: string,
    history?: Array<{ role: string; content: string }>
  ): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: systemPrompt }];

    if (history) {
      for (const msg of history.slice(-10)) {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    messages.push({ role: "user", content: query });
    return messages;
  }

  private extractCitations(
    chunks: Array<{
      documentId: string;
      documentTitle?: string;
      content: string;
    }>
  ): Array<{ documentId: string; documentTitle: string; excerpt: string }> {
    return chunks.slice(0, 5).map((chunk) => ({
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle || "Unknown Document",
      excerpt: `${chunk.content.substring(0, 200)}...`,
    }));
  }
}

export const streamingService = new StreamingService();
