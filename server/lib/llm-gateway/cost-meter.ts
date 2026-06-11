/**
 * Cost meters for the LLM Gateway.
 *
 * The gateway always invokes `meter.record(event)` after a successful call.
 * Concrete meters can:
 *   - log to the structured logger (default in dev),
 *   - persist to the existing `llmCostTracking` table,
 *   - forward to an external observability sink (Datadog, OTel, etc.).
 *
 * Meters must swallow their own errors so telemetry can never break a
 * production LLM call.
 */

import { createLogger } from "../structured-logger";
import type { CostMeter, CostMeterEvent } from "./types";

const logger = createLogger("Lib:LlmGateway:CostMeter");

/**
 * Hardcoded per-1k-token rates (USD). Mirrors
 * `server/enhanced-llm/cost-tracking.ts`. Keep this table in sync until the
 * two are unified.
 */
const RATES_PER_1K_USD: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rate = RATES_PER_1K_USD[model];
  if (!rate) {
    return 0;
  }
  return (promptTokens / 1000) * rate.input + (completionTokens / 1000) * rate.output;
}

/** No-op meter. Useful as a test default and for opt-out callers. */
export class NoopCostMeter implements CostMeter {
  record(_event: CostMeterEvent): void {
    // intentionally empty
  }
}

/**
 * Default production-friendly meter: emits a single structured log line per
 * call at info-level. Cheap, observable, no DB writes.
 */
export class LoggingCostMeter implements CostMeter {
  record(event: CostMeterEvent): void {
    try {
      const costUsd = estimateCostUsd(
        event.model,
        event.usage.promptTokens,
        event.usage.completionTokens
      );
      logger.info("llm.call", {
        provider: event.provider,
        model: event.model,
        promptTokens: event.usage.promptTokens,
        completionTokens: event.usage.completionTokens,
        totalTokens: event.usage.totalTokens,
        latencyMs: event.latencyMs,
        streamed: event.streamed,
        estimatedCostUsd: Number(costUsd.toFixed(6)),
        caller: event.meta?.caller,
        orgId: event.meta?.orgId,
        correlationId: event.meta?.correlationId,
      });
    } catch (err) {
      // Telemetry must never bubble.
      logger.warn("CostMeter record failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Composite meter — fan out to multiple sinks (e.g. logger + DB writer).
 * Each child's failures are isolated.
 */
export class CompositeCostMeter implements CostMeter {
  constructor(private readonly children: CostMeter[]) {}

  async record(event: CostMeterEvent): Promise<void> {
    for (const child of this.children) {
      try {
        await child.record(event);
      } catch (err) {
        logger.warn("Child CostMeter failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
