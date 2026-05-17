/**
 * Enhanced LLM - Provider Implementations
 *
 * OpenAI and Anthropic-specific generation methods.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { ModelConfig, PromptTemplate, CostTrackingContext } from "./types.js";
import { logCostTracking } from "./cost-tracking.js";
import { llmGateway } from "../composition/llm-gateway";
import type { LLMMessage } from "../lib/llm-gateway/types";

/**
 * Generate using OpenAI (via the LLM gateway) with chain-of-thought if requested.
 *
 * Routes through `llmGateway.chat` so retries, model fallback, and cost
 * telemetry are uniform across the codebase. Per-report cost tracking is
 * still emitted here using usage returned by the gateway.
 */
export async function generateWithOpenAI(
  systemPrompt: string,
  userPrompt: string,
  modelConfig: ModelConfig,
  promptTemplate: PromptTemplate,
  costContext: CostTrackingContext,
  startTime: number
): Promise<string> {
  const messages: LLMMessage[] = [{ role: "system", content: systemPrompt }];

  if (promptTemplate.fewShotExamples && promptTemplate.fewShotExamples.length > 0) {
    promptTemplate.fewShotExamples.forEach((example) => {
      messages.push(
        { role: "user", content: example.input },
        { role: "assistant", content: example.output }
      );
    });
  }

  if (promptTemplate.chainOfThought) {
    messages.push({
      role: "user",
      content: `${userPrompt}\n\nThink step-by-step:\n1. Analyze the data\n2. Identify key patterns\n3. Assess risks\n4. Formulate recommendations`,
    });
  } else {
    messages.push({ role: "user", content: userPrompt });
  }

  const completion = await llmGateway.chat({
    model: modelConfig.model,
    messages,
    maxCompletionTokens: modelConfig.maxTokens,
    temperature: modelConfig.temperature,
    meta: {
      caller: "enhanced-llm-report",
      orgId: costContext.orgId,
      reportType: costContext.reportType,
      audience: costContext.audience,
    },
  });

  const latencyMs = Date.now() - startTime;

  await logCostTracking({
    ...costContext,
    provider: "openai",
    model: modelConfig.model,
    inputTokens: completion.usage.promptTokens,
    outputTokens: completion.usage.completionTokens,
    latencyMs,
    success: true,
  });

  return completion.content || "No response generated";
}

/**
 * Generate using Anthropic Claude
 */
export async function generateWithAnthropic(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  modelConfig: ModelConfig,
  costContext: CostTrackingContext,
  startTime: number
): Promise<string> {
  const message = await client.messages.create({
    model: modelConfig.model,
    max_tokens: modelConfig.maxTokens || 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Date.now() - startTime;
  const usage = message.usage;
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;

  await logCostTracking({
    ...costContext,
    provider: "anthropic",
    model: modelConfig.model,
    inputTokens,
    outputTokens,
    latencyMs,
    success: true,
  });

  const content = message.content[0];
  return content.type === "text" ? content.text : "No response generated";
}
