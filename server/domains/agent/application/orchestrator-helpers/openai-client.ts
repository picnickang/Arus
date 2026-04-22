import type OpenAI from "openai";
import type { getToolOpenAIDefinitions } from "../../tools";

/**
 * Call OpenAI chat completions with bounded retry on transient errors.
 *
 * Retries up to 2 times (3 attempts total) with exponential backoff on:
 * 429, 500, 502, 503, ECONNRESET, ETIMEDOUT, ENOTFOUND, or messages
 * containing "timeout"/"network".
 */
export async function callOpenAIWithRetry(
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  toolDefs?: ReturnType<typeof getToolOpenAIDefinitions>
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.chat.completions.create({
        model,
        messages,
        tools: toolDefs && toolDefs.length > 0 ? toolDefs : undefined,
        temperature: 0.3,
        max_tokens: 4096,
      });
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error("OpenAI call failed");
      const statusCode = (err as { status?: number })?.status || 0;
      const errorCode = (err as { code?: string })?.code || "";
      const isRetryable =
        statusCode === 429 ||
        statusCode === 500 ||
        statusCode === 503 ||
        statusCode === 502 ||
        errorCode === "ECONNRESET" ||
        errorCode === "ETIMEDOUT" ||
        errorCode === "ENOTFOUND" ||
        lastError.message.includes("timeout") ||
        lastError.message.includes("network");

      if (!isRetryable || attempt === maxRetries) {
        break;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      console.warn(
        `[Agent] OpenAI attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        lastError.message
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error(
    `AI service is temporarily unavailable. Please try again in a moment. (${lastError?.message || "unknown error"})`
  );
}

/**
 * Best-effort JSON parse for tool-call arguments. Returns `{}` on failure
 * since the OpenAI tool-call protocol guarantees a string but not validity.
 */
export function parseToolArgs(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}
