/**
 * Composition root for the LLM Gateway.
 *
 * This is the single, process-wide gateway instance that application code
 * should consume. It wires the OpenAI provider (reusing the existing
 * retry / model-fallback helpers in `server/openai/client.ts`) to the
 * default logging cost meter.
 *
 * To swap providers, change only this file — callers continue to depend on
 * the `LLMGateway` interface from `server/lib/llm-gateway`.
 */

import {
  budgetGuard,
  DefaultLLMGateway,
  LoggingCostMeter,
  OpenAIProvider,
  redactMessages,
  type LLMGateway,
} from "../lib/llm-gateway/index.js";

const provider = new OpenAIProvider();
const meter = new LoggingCostMeter();

// Budget enforcement is a no-op until OPENAI_DAILY/MONTHLY_TOKEN_BUDGET is set,
// so wiring the singleton here is backward-compatible. PII redaction is always
// on for outbound messages (it only rewrites detected PII, otherwise a no-op).
export const llmGateway: LLMGateway = new DefaultLLMGateway({
  provider,
  meter,
  budgetGuard,
  redactor: { redactMessages },
});
