/**
 * DefaultLLMGateway — wires a provider + cost meter behind the
 * `LLMGateway` port.
 *
 * Today this is a thin wrapper over a single provider. The shape is
 * deliberately ready for future multi-provider routing (e.g. choose a
 * different provider based on `params.meta.caller` or `params.model`)
 * without forcing callers to change.
 */

import { createLogger } from "../structured-logger";
import { NoopCostMeter } from "./cost-meter";
import type {
  BudgetGuardPort,
  CostMeter,
  LLMCallMeta,
  LLMChatParams,
  LLMChatResponse,
  LLMGateway,
  LLMProviderPort,
  LLMStreamChunk,
  LLMUsage,
  MessageRedactor,
} from "./types";

const logger = createLogger("Lib:LlmGateway:Gateway");

/** Fallback completion-token cap used to estimate budget when the caller did
 * not pin `maxCompletionTokens`. Conservative so preflight cannot be trivially
 * under-counted by omitting the cap. */
const DEFAULT_COMPLETION_TOKEN_CAP = 1024;
/** Rough chars-per-token ratio for prompt-token estimation (OpenAI ~4). */
const CHARS_PER_TOKEN = 4;

export interface DefaultLLMGatewayDeps {
  /** Primary provider used for all calls until routing is added. */
  provider: LLMProviderPort;
  /** Optional cost meter. Defaults to a no-op. */
  meter?: CostMeter;
  /**
   * Optional per-tenant token-budget guard. When set, the gateway preflights
   * every call (aborting over-budget requests before the provider is hit) and
   * records actual usage afterwards. Absent ⇒ no budget enforcement.
   */
  budgetGuard?: BudgetGuardPort;
  /**
   * Optional outbound PII redactor. When set, message content is redacted
   * before it reaches the provider. Absent ⇒ messages pass through unchanged.
   */
  redactor?: MessageRedactor;
}

export class DefaultLLMGateway implements LLMGateway {
  private readonly provider: LLMProviderPort;
  private readonly meter: CostMeter;
  private readonly budgetGuard: BudgetGuardPort | undefined;
  private readonly redactor: MessageRedactor | undefined;

  constructor(deps: DefaultLLMGatewayDeps) {
    this.provider = deps.provider;
    this.meter = deps.meter ?? new NoopCostMeter();
    this.budgetGuard = deps.budgetGuard;
    this.redactor = deps.redactor;
  }

  get name(): string {
    return this.provider.name;
  }

  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    // Redact PII before anything leaves the process, then enforce budget.
    // Preflight throws (e.g. BudgetExceededError) and is intentionally NOT
    // swallowed — the caller must fall back to a non-LLM path.
    const effectiveParams = this.applyRedaction(params);
    this.preflightBudget(effectiveParams);

    const response = await this.provider.chat(effectiveParams);
    this.safeRecord({
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      latencyMs: response.latencyMs,
      streamed: false,
      meta: effectiveParams.meta,
    });
    this.recordBudget(effectiveParams.meta, response.model, response.usage);
    return response;
  }

  async *chatStream(params: LLMChatParams): AsyncIterable<LLMStreamChunk> {
    const effectiveParams = this.applyRedaction(params);
    this.preflightBudget(effectiveParams);

    const started = Date.now();
    let finalUsage: LLMUsage | undefined;

    for await (const chunk of this.provider.chatStream(effectiveParams)) {
      if (chunk.usage) {
        finalUsage = chunk.usage;
      }
      yield chunk;
    }

    if (finalUsage) {
      this.safeRecord({
        provider: this.provider.name,
        model: effectiveParams.model,
        usage: finalUsage,
        latencyMs: Date.now() - started,
        streamed: true,
        meta: effectiveParams.meta,
      });
      this.recordBudget(effectiveParams.meta, effectiveParams.model, finalUsage);
    }
  }

  /** Run the outbound redactor over the messages, if configured. */
  private applyRedaction(params: LLMChatParams): LLMChatParams {
    if (!this.redactor) {
      return params;
    }
    const { messages } = this.redactor.redactMessages(params.messages);
    return { ...params, messages };
  }

  /**
   * Estimate the worst-case token cost of a call and ask the budget guard to
   * approve it. No-op when no guard is wired or the call carries no orgId
   * (budgets are per-tenant). A guard rejection propagates to the caller.
   */
  private preflightBudget(params: LLMChatParams): void {
    const orgId = params.meta?.orgId;
    if (!this.budgetGuard || !orgId) {
      return;
    }
    this.budgetGuard.preflight(orgId, estimateProjectedTokens(params));
  }

  /** Record actual tokens consumed. Failures here must not bubble. */
  private recordBudget(
    meta: LLMCallMeta | undefined,
    model: string,
    usage: LLMUsage | undefined
  ): void {
    const orgId = meta?.orgId;
    if (!this.budgetGuard || !orgId || !usage) {
      return;
    }
    try {
      this.budgetGuard.record(orgId, model, usage.totalTokens);
    } catch (err) {
      logger.warn("BudgetGuard record failure swallowed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private safeRecord(event: Parameters<CostMeter["record"]>[0]): void {
    try {
      const result = this.meter.record(event);
      if (result && typeof (result as Promise<void>).then === "function") {
        (result as Promise<void>).catch((err) => {
          logger.warn("CostMeter async failure swallowed", {
            err: err instanceof Error ? err.message : String(err),
          });
        });
      }
    } catch (err) {
      logger.warn("CostMeter sync failure swallowed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Upper-bound estimate of the tokens a chat call will consume: a prompt
 * estimate (total message characters / ~4) plus the completion cap. Used only
 * for the pre-call budget gate; the post-call `record` uses real usage. Errs
 * high so a runaway loop is stopped rather than under-counted.
 */
function estimateProjectedTokens(params: LLMChatParams): number {
  let chars = 0;
  for (const message of params.messages) {
    const { content } = message;
    if (typeof content === "string") {
      chars += content.length;
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "text") {
          chars += part.text.length;
        }
      }
    }
  }
  const promptEstimate = Math.ceil(chars / CHARS_PER_TOKEN);
  const completionCap = params.maxCompletionTokens ?? DEFAULT_COMPLETION_TOKEN_CAP;
  return promptEstimate + completionCap;
}
