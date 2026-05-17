/**
 * LLM-call helper for the Agent Orchestrator.
 *
 * Previously this wrapped the raw OpenAI SDK with bounded retry. Retries and
 * model-fallback now live inside the LLM gateway (`llmGateway.chat`), so this
 * file is a thin pass-through that keeps the orchestrator's call-site shape
 * stable while consolidating provider concerns behind the gateway port.
 */

import { llmGateway } from "../../../../composition/llm-gateway";
import type {
  LLMChatResponse,
  LLMMessage,
  LLMToolDefinition,
} from "../../../../lib/llm-gateway/types";

/**
 * Call the LLM gateway with the orchestrator's standard parameters
 * (temperature 0.3, max_completion_tokens 4096, optional tool defs) and
 * forward caller metadata for cost attribution. Errors propagate; the
 * gateway has already applied retry / model-fallback.
 */
export async function callLLMWithRetry(
  model: string,
  messages: LLMMessage[],
  toolDefs?: LLMToolDefinition[],
  meta?: Record<string, unknown>
): Promise<LLMChatResponse> {
  return llmGateway.chat({
    model,
    messages,
    tools: toolDefs && toolDefs.length > 0 ? toolDefs : undefined,
    temperature: 0.3,
    maxCompletionTokens: 4096,
    meta: { caller: "agent-orchestrator", ...meta },
  });
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
