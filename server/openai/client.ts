/**
 * OpenAI Client Management - API key, client creation, retry logic
 */

import OpenAI from "openai";
import { dbSystemAdminStorage } from "../repositories";
import type { ErrorAnalysisResult } from "./types";
import { cryptoRandom } from "@shared/crypto-random";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Openai:Client");

/**
 * Type for settings accessor function to enable dependency injection
 */
export type SettingsAccessor = () => Promise<{ openaiApiKey?: string | null }>;

/**
 * Get the effective OpenAI API key from settings or environment
 * Priority order:
 * 1. User-configured key in settings (database)
 * 2. OPENAI_API_KEY environment variable
 * 3. AI_INTEGRATIONS_OPENAI_API_KEY (Replit AI Integrations)
 *
 * @param getSettingsFn Optional settings accessor function for dependency injection.
 *                      If not provided, uses the global storage singleton.
 */
export async function getOpenAIApiKey(
  getSettingsFn?: SettingsAccessor
): Promise<string | undefined> {
  try {
    const settingsAccessor = getSettingsFn || (async () => dbSystemAdminStorage.getSettings());
    const settings = await settingsAccessor();
    if (settings.openaiApiKey) {
      return settings.openaiApiKey;
    }
  } catch (error) {
    logger.error("Failed to get API key from settings, falling back to environment:", undefined, error);
  }

  // Check environment variables in priority order
  return process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
}

/**
 * Create OpenAI client with dynamic API key
 */
export async function createOpenAIClient(): Promise<OpenAI | null> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    logger.error("No OpenAI API key available - AI features will be unavailable");
    return null;
  }
  return new OpenAI({
    apiKey,
    timeout: 45000,
  });
}

/**
 * Calculate dynamic token allocation based on input data size
 */
export function calculateDynamicTokens(
  dataSize: number,
  baseTokens: number = 1500,
  maxTokens: number = 4096
): number {
  const estimatedInputTokens = Math.ceil(dataSize / 4);
  const scaledTokens = baseTokens + Math.floor(estimatedInputTokens / 1000) * 500;
  return Math.min(Math.max(scaledTokens, baseTokens), maxTokens);
}

/**
 * Determine appropriate retry strategy based on error type
 */
export function analyzeErrorType(error: unknown): ErrorAnalysisResult {
  const err = (error ?? {}) as { message?: unknown; code?: unknown; type?: unknown };
  const errorMessage = typeof err.message === "string" ? err.message.toLowerCase() : "";
  const errorCode = typeof err.code === "string" ? err.code.toLowerCase() : "";
  const errorType = typeof err.type === "string" ? err.type.toLowerCase() : "";

  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("rate_limit") ||
    errorMessage.includes("rate-limit") ||
    errorCode === "rate_limit_exceeded" ||
    errorType === "rate_limit_error"
  ) {
    return {
      shouldRetry: true,
      suggestedDelay: 5000,
      fallbackModel: "gpt-4o-mini",
      recommendation: "Rate limit hit - falling back to gpt-4o-mini",
    };
  }

  if (errorMessage.includes("timeout") || errorCode === "timeout") {
    return {
      shouldRetry: true,
      recommendation: "Timeout error - retrying with same model",
    };
  }

  if (errorMessage.includes("server_error") || errorMessage.includes("internal_error")) {
    return {
      shouldRetry: true,
      recommendation: "Server error - retrying with same model",
    };
  }

  if (errorMessage.includes("model_overloaded") || errorMessage.includes("overloaded")) {
    return {
      shouldRetry: true,
      suggestedDelay: 3000,
      fallbackModel: "gpt-4o-mini",
      recommendation: "Model overloaded - falling back to gpt-4o-mini",
    };
  }

  if (errorMessage.includes("invalid_api_key") || errorMessage.includes("authentication")) {
    return {
      shouldRetry: false,
      recommendation: "Authentication error - check API key configuration",
    };
  }

  if (
    errorMessage.includes("context_length_exceeded") ||
    errorMessage.includes("maximum context")
  ) {
    return {
      shouldRetry: false,
      recommendation: "Input too large - reduce data size or use summarization",
    };
  }

  if (errorMessage.includes("invalid_request") || errorCode === "invalid_request_error") {
    return {
      shouldRetry: false,
      recommendation: "Invalid request format - check request parameters",
    };
  }

  if (errorMessage.includes("content_filter") || errorMessage.includes("content_policy")) {
    return {
      shouldRetry: false,
      recommendation: "Content policy violation - review input content",
    };
  }

  return {
    shouldRetry: true,
    recommendation: "Unknown error - attempting retry with same model",
  };
}

/**
 * Retry mechanism with exponential backoff and intelligent error handling
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorAnalysis = analyzeErrorType(error);
      const errMsg = error instanceof Error ? error.message : String(error);

      if (!errorAnalysis.shouldRetry) {
        logger.error(`Non-retryable error: ${errorAnalysis.recommendation}`, undefined, errMsg);
        throw error;
      }

      if (attempt === maxRetries) {
        logger.error(`Max retries (${maxRetries}) reached for OpenAI operation: ${errorAnalysis.recommendation}`);
        break;
      }

      const errorSpecificDelay = errorAnalysis.suggestedDelay || baseDelay;
      const exponentialDelay = errorSpecificDelay * Math.pow(2, attempt);
      const jitter = cryptoRandom() * 1000;
      const delay = exponentialDelay + jitter;

      logger.warn(
        `OpenAI request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${errorAnalysis.recommendation}. ` +
          `Retrying in ${Math.round(delay)}ms...`,
        { details: errMsg }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("OpenAI operation failed after retries");
}

/**
 * Wrapper for OpenAI API calls with model fallback capability
 */
type ChatCreateParams = Parameters<OpenAI["chat"]["completions"]["create"]>[0];
type ChatCreateResult = Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;

export async function callWithModelFallback(
  openai: OpenAI,
  params: {
    model: string;
    messages: ChatCreateParams["messages"];
    response_format?: ChatCreateParams["response_format"];
    max_completion_tokens?: number;
  }
): Promise<ChatCreateResult> {
  try {
    return await retryWithBackoff(() => openai.chat.completions.create(params as ChatCreateParams) as Promise<ChatCreateResult>);
  } catch (error: unknown) {
    const errorAnalysis = analyzeErrorType(error);

    if (errorAnalysis.fallbackModel && params.model !== errorAnalysis.fallbackModel) {
      logger.warn(`Falling back from ${params.model} to ${errorAnalysis.fallbackModel} due to: ${errorAnalysis.recommendation}`);

      return await retryWithBackoff(() =>
        openai.chat.completions.create({
          ...params,
          model: errorAnalysis.fallbackModel!,
        } as ChatCreateParams) as Promise<ChatCreateResult>
      );
    }

    throw error;
  }
}
