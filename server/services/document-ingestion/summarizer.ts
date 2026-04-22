/**
 * Document Auto-Summarization Service
 *
 * Uses LLM to generate concise summaries of ingested documents.
 * Summaries are stored with documents for quick reference and
 * can be used for RAG context enhancement.
 */

import { createOpenAIClient } from "../../openai/client";
import { logger } from "../../utils/logger";

const SUMMARIZATION_PROMPT = `You are a technical document summarizer for a marine fleet management system.
Create a concise summary of the following document content.

Guidelines:
- Keep the summary under 300 words
- Focus on key technical details, specifications, and procedures
- Highlight any safety-critical information
- Note equipment types, part numbers, or regulatory references mentioned
- Use clear, professional language

Document content:
{content}

Provide a summary that captures the essential information a marine engineer or fleet operator would need.`;

export interface SummarizationOptions {
  maxContentLength?: number;
  model?: string;
  openAiKey?: string;
}

export interface SummarizationResult {
  summary: string;
  tokenCount: {
    prompt: number;
    completion: number;
  };
  model: string;
  durationMs: number;
}

export async function summarizeDocument(
  content: string,
  options: SummarizationOptions = {}
): Promise<SummarizationResult | null> {
  const { maxContentLength = 12000, model = "gpt-4o-mini" } = options;

  const startTime = Date.now();

  try {
    const client = await createOpenAIClient();
    if (!client) {
      logger.warn("[Summarizer] OpenAI client unavailable - skipping summarization");
      return null;
    }

    const truncatedContent =
      content.length > maxContentLength
        ? `${content.slice(0, maxContentLength)}...[truncated]`
        : content;

    const prompt = SUMMARIZATION_PROMPT.replace("{content}", truncatedContent);

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    });

    const summary = response.choices[0]?.message?.content || "";
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };

    const result: SummarizationResult = {
      summary: summary.trim(),
      tokenCount: {
        prompt: usage.prompt_tokens,
        completion: usage.completion_tokens,
      },
      model,
      durationMs: Date.now() - startTime,
    };

    logger.info(
      `[Summarizer] Generated summary: ${result.summary.length} chars in ${result.durationMs}ms`
    );
    return result;
  } catch (error: any) {
    logger.error("[Summarizer] Failed to generate summary:", error.message);
    return null;
  }
}

export async function generateKeywords(
  content: string,
  maxKeywords: number = 10
): Promise<string[]> {
  try {
    const client = await createOpenAIClient();
    if (!client) {
      return [];
    }

    const truncated = content.slice(0, 8000);

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Extract the ${maxKeywords} most important keywords from this marine engineering document. Return only a comma-separated list of keywords, nothing else.\n\nDocument:\n${truncated}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.1,
    });

    const keywordsText = response.choices[0]?.message?.content || "";
    return keywordsText
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0)
      .slice(0, maxKeywords);
  } catch (error: any) {
    logger.error("[Summarizer] Failed to extract keywords:", error.message);
    return [];
  }
}
