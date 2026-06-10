/**
 * LLM Gateway — public surface.
 *
 * Application code should import the gateway from
 * `server/composition/llm-gateway.ts` (the wired singleton). This module
 * exports the building blocks (port, types, default implementations) for
 * tests and future composition roots.
 */

export type {
  BudgetGuardPort,
  CostMeter,
  CostMeterEvent,
  LLMCallMeta,
  LLMChatParams,
  LLMChatResponse,
  LLMGateway,
  LLMMessage,
  LLMProviderPort,
  LLMRole,
  LLMStreamChunk,
  LLMToolCall,
  LLMToolDefinition,
  LLMUsage,
  MessageRedactor,
} from "./types";

export { OpenAIProvider } from "./openai-provider";
export { CompositeCostMeter, LoggingCostMeter, NoopCostMeter, estimateCostUsd } from "./cost-meter";
export { DefaultLLMGateway } from "./gateway";
export { BudgetGuard, BudgetExceededError, budgetGuard } from "./budget-guard";
export { redactMessages, redactPII } from "./pii-redactor";
