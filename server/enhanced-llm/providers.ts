/**
 * Enhanced LLM - Provider Implementations
 *
 * OpenAI and Anthropic-specific generation methods.
 */

import type OpenAI from "openai";
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelConfig, PromptTemplate, CostTrackingContext } from "./types.js";
import { logCostTracking } from "./cost-tracking.js";

/**
 * Generate using OpenAI with chain-of-thought if requested
 */
export async function generateWithOpenAI(
  client: OpenAI,
  systemPrompt: string,
  userPrompt: string,
  modelConfig: ModelConfig,
  promptTemplate: PromptTemplate,
  costContext: CostTrackingContext,
  startTime: number
): Promise<string> {
  const messages: any[] = [{ role: "system", content: systemPrompt }];

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

  const completion = await client.chat.completions.create({
    model: modelConfig.model,
    messages,
    max_tokens: modelConfig.maxTokens,
    temperature: modelConfig.temperature,
  });

  const latencyMs = Date.now() - startTime;
  const usage = completion.usage;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;

  await logCostTracking({
    ...costContext,
    provider: "openai",
    model: modelConfig.model,
    inputTokens,
    outputTokens,
    latencyMs,
    success: true,
  });

  return completion.choices[0]?.message?.content || "No response generated";
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
