/**
 * Enhanced LLM - Model Configuration
 *
 * Default model configurations and model selection logic.
 */

import type { ModelConfig } from "./types.js";

export const defaultModels: Record<string, ModelConfig> = {
  "gpt-4o": {
    provider: "openai",
    model: "gpt-4o",
    maxTokens: 4000,
    fallbackModel: {
      provider: "openai",
      model: "gpt-4o-mini",
      maxTokens: 4000,
    },
  },
  o1: {
    provider: "openai",
    model: "o1",
    maxTokens: 8000,
  },
  "claude-3-5-sonnet": {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    maxTokens: 4000,
    fallbackModel: {
      provider: "anthropic",
      model: "claude-3-haiku-20240307",
      maxTokens: 4000,
    },
  },
};

/**
 * Get model configuration with fallback
 */
export function getModelConfig(
  preference: string | undefined,
  openaiAvailable: boolean,
  anthropicAvailable: boolean
): ModelConfig {
  if (preference && defaultModels[preference]) {
    return defaultModels[preference]!;
  }

  if (openaiAvailable) {
    return defaultModels["gpt-4o"]!;
  }

  if (anthropicAvailable) {
    return defaultModels["claude-3-5-sonnet"]!;
  }

  throw new Error("No LLM providers available");
}
