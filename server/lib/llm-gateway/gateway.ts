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
  CostMeter,
  LLMChatParams,
  LLMChatResponse,
  LLMGateway,
  LLMProviderPort,
  LLMStreamChunk,
  LLMUsage,
} from "./types";

const logger = createLogger("Lib:LlmGateway:Gateway");

export interface DefaultLLMGatewayDeps {
  /** Primary provider used for all calls until routing is added. */
  provider: LLMProviderPort;
  /** Optional cost meter. Defaults to a no-op. */
  meter?: CostMeter;
}

export class DefaultLLMGateway implements LLMGateway {
  private readonly provider: LLMProviderPort;
  private readonly meter: CostMeter;

  constructor(deps: DefaultLLMGatewayDeps) {
    this.provider = deps.provider;
    this.meter = deps.meter ?? new NoopCostMeter();
  }

  get name(): string {
    return this.provider.name;
  }

  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    const response = await this.provider.chat(params);
    this.safeRecord({
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      latencyMs: response.latencyMs,
      streamed: false,
      meta: params.meta,
    });
    return response;
  }

  async *chatStream(params: LLMChatParams): AsyncIterable<LLMStreamChunk> {
    const started = Date.now();
    let finalUsage: LLMUsage | undefined;

    for await (const chunk of this.provider.chatStream(params)) {
      if (chunk.usage) {finalUsage = chunk.usage;}
      yield chunk;
    }

    if (finalUsage) {
      this.safeRecord({
        provider: this.provider.name,
        model: params.model,
        usage: finalUsage,
        latencyMs: Date.now() - started,
        streamed: true,
        meta: params.meta,
      });
    }
  }

  private safeRecord(event: Parameters<CostMeter["record"]>[0]): void {
    try {
      const result = this.meter.record(event);
      if (result && typeof (result as Promise<void>).then === "function") {
        (result as Promise<void>).catch((err) => {
          logger.warn("CostMeter async failure swallowed", { err: err instanceof Error ? err.message : String(err) });
        });
      }
    } catch (err) {
      logger.warn("CostMeter sync failure swallowed", { err: err instanceof Error ? err.message : String(err) });
    }
  }
}
