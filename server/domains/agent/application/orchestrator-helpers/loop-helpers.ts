import { DEFAULT_CONFIG } from "../../domain/types";
import type { CompactionConfig } from "../context-compaction";
import type { AgentConversation, AgentConfigType } from "@shared/schema";

/**
 * Build a compaction config from agent settings, falling back to defaults.
 */
export function getCompactionConfig(
  config: AgentConfigType | null | undefined,
  model: string
): CompactionConfig {
  return {
    enabled: config?.contextCompaction ?? DEFAULT_CONFIG.contextCompaction,
    threshold: config?.compactionThreshold ?? DEFAULT_CONFIG.compactionThreshold,
    model,
    toolOutputCharLimit: config?.toolOutputCharLimit ?? DEFAULT_CONFIG.toolOutputCharLimit,
  };
}

/**
 * Whether deferred tool loading is enabled (defaults to true).
 */
export function isDeferredToolLoadingEnabled(config: AgentConfigType | null | undefined): boolean {
  return config?.deferredToolLoading ?? true;
}

/**
 * Read the activated-tool list previously persisted on the conversation
 * metadata. Returns empty when missing/malformed.
 */
export function getActivatedToolsFromMetadata(conversation: AgentConversation): string[] {
  const meta = conversation.metadata as Record<string, unknown> | null;
  if (meta && Array.isArray(meta["activatedTools"])) {
    return meta["activatedTools"] as string[];
  }
  return [];
}

/**
 * After a `listAvailableTools` discovery call, expand the activated-tools
 * set with everything in the discovered categories (respecting any
 * `enabledTools` allowlist), and trim the result returned to the model.
 *
 * Mutates `activatedTools` and `toolResult.categories` / `toolResult.totalTools`.
 */
export function expandActivatedToolsFromDiscovery(
  toolResult: Record<string, unknown>,
  activatedTools: Set<string>,
  input: Record<string, unknown>,
  enabledTools?: string[] | null
): void {
  const categories = toolResult["categories"] as Record<string, { name: string }[]> | undefined;
  if (!categories) {
    return;
  }

  const enabledSet =
    Array.isArray(enabledTools) && enabledTools.length > 0 ? new Set(enabledTools) : null;
  const requestedCategory = input["category"] as string | undefined;
  for (const [cat, tools] of Object.entries(categories)) {
    if (requestedCategory && cat !== requestedCategory) {
      continue;
    }
    for (const t of tools) {
      if (!t.name) {
        continue;
      }
      if (enabledSet && !enabledSet.has(t.name)) {
        continue;
      }
      activatedTools.add(t.name);
    }
  }

  if (enabledSet) {
    const filtered: Record<string, { name: string }[]> = {};
    for (const [cat, tools] of Object.entries(categories)) {
      const allowed = tools.filter((t) => enabledSet.has(t.name));
      if (allowed.length > 0) {
        filtered[cat] = allowed;
      }
    }
    toolResult["categories"] = filtered;
    toolResult["totalTools"] = Object.values(filtered).reduce((sum, arr) => sum + arr.length, 0);
  }
}

/**
 * Heuristic: detect when the model is refusing or stalling and a
 * fallback (full tool loading) is warranted.
 */
export function looksLikeFallbackNeeded(response: string): boolean {
  if (!response) {
    return true;
  }
  const lower = response.toLowerCase();
  const refusalPhrases = [
    "i can't",
    "i cannot",
    "i don't have",
    "i'm unable",
    "i am unable",
    "i'm not able",
    "i am not able",
    "i don't have access",
    "no tools",
    "outside my capabilities",
    "beyond my capabilities",
    "don't have the ability",
    "not equipped",
    "no way to",
  ];
  if (refusalPhrases.some((p) => lower.includes(p))) {
    return true;
  }
  if (response.length < 40 && /\?/.test(response)) {
    return true;
  }
  return false;
}

/**
 * Build the system prompt fragment that triggers an automated agent run
 * for a high-risk failure prediction signal.
 */
export function buildSignalPrompt(signal: {
  failureProbability: number;
  failureMode: string;
  riskLevel: string;
  equipmentId: string;
  predictedFailureDate?: string | Date | null;
  costImpact?: unknown;
}): string {
  const pct = (signal.failureProbability * 100).toFixed(0);
  const dateStr = signal.predictedFailureDate
    ? ` Predicted failure date: ${signal.predictedFailureDate}.`
    : "";

  let costContext = "";
  if (signal.costImpact) {
    const ci = signal.costImpact as {
      estimatedRepairCost?: number;
      revenueImpact?: number;
      estimatedDowntime?: number;
    };
    if (ci.estimatedRepairCost || ci.revenueImpact) {
      const fmt = (v: number) => (v >= 1000 ? `~$${(v / 1000).toFixed(0)}K` : `~$${v.toFixed(0)}`);
      costContext = ` Estimated repair cost: ${fmt(ci.estimatedRepairCost ?? 0)}. Estimated failure impact: ${fmt(ci.revenueImpact ?? 0)}.`;
      costContext += ` When drafting a work order, include a costJustification summarizing these costs and the prediction confidence.`;
    }
  }

  return (
    `AUTOMATED SIGNAL: A high-risk failure prediction has been detected. ` +
    `Equipment ${signal.equipmentId} has a ${pct}% probability of ${signal.failureMode} failure ` +
    `(risk level: ${signal.riskLevel}).${dateStr}${costContext} ` +
    `Please investigate this equipment, check its recent maintenance history, review any related alerts, ` +
    `and recommend immediate actions to prevent the predicted failure. ` +
    `If appropriate, draft a preventive maintenance work order.`
  );
}
