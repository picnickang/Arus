/**
 * Wave 3.7 — OpenAI cost guardrails.
 *
 * Per-tenant token budget enforcement layered in front of the LLM
 * provider. Two tiers:
 *   - soft (default 80% of limit): logs a warn and emits a Prometheus
 *     counter so the dashboard can light up; calls still proceed.
 *   - hard (100% of limit): throws a `BudgetExceededError` so the caller
 *     can fall back to a deterministic, no-LLM code path.
 *
 * Counters are in-memory and rotate at the start of each UTC day /
 * month. Restarts reset the daily window — acceptable for a guardrail
 * (the goal is "stop a runaway loop", not "bill accurately"; the
 * existing `llmCostTracking` table already does the accounting). For
 * persisted budgets across restarts, a future task can snapshot to a
 * `tenant_llm_usage` table.
 *
 * Budgets are sourced from env vars (`OPENAI_DAILY_TOKEN_BUDGET`,
 * `OPENAI_MONTHLY_TOKEN_BUDGET`) with a per-tenant override map. Calling
 * with no budget configured is a no-op.
 */

import client from "prom-client";
import { createLogger } from "../structured-logger";

const logger = createLogger("Lib:LlmGateway:BudgetGuard");

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly window: "daily" | "monthly",
    public readonly orgId: string,
    public readonly tokensUsed: number,
    public readonly tokensLimit: number
  ) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export const llmTokensConsumed = new client.Counter({
  name: "arus_llm_tokens_consumed_total",
  help: "Total LLM tokens consumed (post-call recording).",
  labelNames: ["org_id", "model"],
});

export const llmBudgetUtilization = new client.Gauge({
  name: "arus_llm_budget_utilization_ratio",
  help: "LLM token-budget utilization ratio (0..1+) per tenant per window.",
  labelNames: ["org_id", "window"],
});

export const llmBudgetBreaches = new client.Counter({
  name: "arus_llm_budget_breaches_total",
  help: "LLM budget breach events (soft/hard).",
  labelNames: ["org_id", "window", "severity"],
});

interface WindowUsage {
  windowKey: string;
  tokens: number;
}

interface TenantUsage {
  daily: WindowUsage;
  monthly: WindowUsage;
}

export interface BudgetLimits {
  dailyTokens?: number | undefined;
  monthlyTokens?: number | undefined;
  softRatio?: number | undefined;
}

const DEFAULT_SOFT_RATIO = 0.8;

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function monthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export class BudgetGuard {
  private readonly usage = new Map<string, TenantUsage>();
  private readonly overrides = new Map<string, BudgetLimits>();
  private readonly softBreachedThisWindow = new Set<string>();

  constructor(private readonly defaults: BudgetLimits = {}) {}

  setTenantLimits(orgId: string, limits: BudgetLimits): void {
    this.overrides.set(orgId, limits);
  }

  private limitsFor(orgId: string): BudgetLimits {
    return { ...this.defaults, ...(this.overrides.get(orgId) ?? {}) };
  }

  private getOrInit(orgId: string): TenantUsage {
    let u = this.usage.get(orgId);
    const today = todayKey();
    const month = monthKey();
    if (!u) {
      u = { daily: { windowKey: today, tokens: 0 }, monthly: { windowKey: month, tokens: 0 } };
      this.usage.set(orgId, u);
    } else {
      if (u.daily.windowKey !== today) {
        u.daily = { windowKey: today, tokens: 0 };
        this.softBreachedThisWindow.delete(`${orgId}|daily|${today}`);
      }
      if (u.monthly.windowKey !== month) {
        u.monthly = { windowKey: month, tokens: 0 };
        this.softBreachedThisWindow.delete(`${orgId}|monthly|${month}`);
      }
    }
    return u;
  }

  /**
   * Throw if the projected token spend would exceed the hard limit.
   * Called BEFORE the LLM request is issued. `projectedTokens` is the
   * estimated total cost of the about-to-be-issued call (prompt tokens
   * upper bound + max completion tokens).
   */
  preflight(orgId: string, projectedTokens: number): void {
    const limits = this.limitsFor(orgId);
    if (!limits.dailyTokens && !limits.monthlyTokens) return;
    const u = this.getOrInit(orgId);

    if (limits.dailyTokens && u.daily.tokens + projectedTokens > limits.dailyTokens) {
      llmBudgetBreaches.inc({ org_id: orgId, window: "daily", severity: "hard" });
      throw new BudgetExceededError(
        `Daily LLM token budget exceeded for tenant ${orgId}: ${u.daily.tokens}+${projectedTokens} > ${limits.dailyTokens}`,
        "daily",
        orgId,
        u.daily.tokens,
        limits.dailyTokens
      );
    }
    if (limits.monthlyTokens && u.monthly.tokens + projectedTokens > limits.monthlyTokens) {
      llmBudgetBreaches.inc({ org_id: orgId, window: "monthly", severity: "hard" });
      throw new BudgetExceededError(
        `Monthly LLM token budget exceeded for tenant ${orgId}: ${u.monthly.tokens}+${projectedTokens} > ${limits.monthlyTokens}`,
        "monthly",
        orgId,
        u.monthly.tokens,
        limits.monthlyTokens
      );
    }
  }

  /**
   * Record actual tokens consumed AFTER the call. Emits Prometheus
   * counters, updates the utilization gauges, and fires a one-shot
   * warn on soft-breach (every soft-breach per window logs once, not
   * per call, to avoid log spam).
   */
  record(orgId: string, model: string, tokens: number): void {
    if (tokens <= 0) return;
    llmTokensConsumed.inc({ org_id: orgId, model }, tokens);

    const limits = this.limitsFor(orgId);
    if (!limits.dailyTokens && !limits.monthlyTokens) return;
    const u = this.getOrInit(orgId);
    u.daily.tokens += tokens;
    u.monthly.tokens += tokens;
    const softRatio = limits.softRatio ?? DEFAULT_SOFT_RATIO;

    if (limits.dailyTokens) {
      const ratio = u.daily.tokens / limits.dailyTokens;
      llmBudgetUtilization.set({ org_id: orgId, window: "daily" }, ratio);
      const softKey = `${orgId}|daily|${u.daily.windowKey}`;
      if (ratio >= softRatio && !this.softBreachedThisWindow.has(softKey)) {
        this.softBreachedThisWindow.add(softKey);
        llmBudgetBreaches.inc({ org_id: orgId, window: "daily", severity: "soft" });
        logger.warn(`LLM daily soft budget crossed for ${orgId} (${(ratio * 100).toFixed(1)}%)`, {
          orgId,
          tokensUsed: u.daily.tokens,
          tokensLimit: limits.dailyTokens,
        });
      }
    }
    if (limits.monthlyTokens) {
      const ratio = u.monthly.tokens / limits.monthlyTokens;
      llmBudgetUtilization.set({ org_id: orgId, window: "monthly" }, ratio);
      const softKey = `${orgId}|monthly|${u.monthly.windowKey}`;
      if (ratio >= softRatio && !this.softBreachedThisWindow.has(softKey)) {
        this.softBreachedThisWindow.add(softKey);
        llmBudgetBreaches.inc({ org_id: orgId, window: "monthly", severity: "soft" });
        logger.warn(`LLM monthly soft budget crossed for ${orgId} (${(ratio * 100).toFixed(1)}%)`, {
          orgId,
          tokensUsed: u.monthly.tokens,
          tokensLimit: limits.monthlyTokens,
        });
      }
    }
  }

  snapshot(orgId: string): TenantUsage | undefined {
    return this.usage.get(orgId);
  }
}

function parseEnvInt(key: string): number | undefined {
  const raw = process.env[key];
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export const budgetGuard = new BudgetGuard({
  dailyTokens: parseEnvInt("OPENAI_DAILY_TOKEN_BUDGET"),
  monthlyTokens: parseEnvInt("OPENAI_MONTHLY_TOKEN_BUDGET"),
});
