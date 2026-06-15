import { dbNotificationsStorage } from "../../../db/notifications/index.js";
import { createLogger } from "../../../lib/structured-logger";
import { llmGateway } from "../../../composition/llm-gateway";
import type { AgentRepositoryPort } from "../domain/ports";
import type { AgentSuggestion } from "@shared/schema/agent";

const logger = createLogger("Domains:Agent:Application:SuggestionEngine");

export interface SupportSuggestionPreferences {
  maintenance: boolean;
  predictions: boolean;
  crew: boolean;
  inventory: boolean;
  alerts: boolean;
  minSeverity: "info" | "warning" | "critical";
}

export const DEFAULT_PREFERENCES: SupportSuggestionPreferences = {
  maintenance: true,
  predictions: true,
  crew: true,
  inventory: true,
  alerts: true,
  minSeverity: "info",
};

const SEVERITY_RANK: Record<string, number> = { info: 0, warning: 1, critical: 2 };

export function meetsMinSeverity(severity: string, min: string): boolean {
  return (SEVERITY_RANK[severity] ?? 0) >= (SEVERITY_RANK[min] ?? 0);
}

export interface PredictionCostImpact {
  estimatedRepairCost?: number;
  estimatedDowntime?: number;
  revenueImpact?: number;
}

export function buildPredictionCostLine(costImpact: PredictionCostImpact | null): string {
  if (!costImpact || (!costImpact.estimatedRepairCost && !costImpact.revenueImpact)) {
    return "";
  }

  const repairCost = costImpact.estimatedRepairCost ?? 0;
  const failureCost = costImpact.revenueImpact ?? 0;
  const savings = failureCost - repairCost;
  const fmt = (value: number) =>
    value >= 1000 ? `~$${(value / 1000).toFixed(0)}K` : `~$${value.toFixed(0)}`;
  let savingsText = "";
  if (savings > 0) {
    savingsText = ` Potential savings: ${fmt(savings)}.`;
  } else if (savings === 0) {
    savingsText = ` Net cost variance: $0.`;
  } else {
    savingsText = ` Net cost: repair exceeds failure impact by ${fmt(Math.abs(savings))}.`;
  }
  return ` Estimated repair: ${fmt(repairCost)}. Estimated failure impact: ${fmt(failureCost)}.${savingsText}`;
}

export async function summarizeSuggestionsWithAi(
  repo: AgentRepositoryPort,
  suggestions: AgentSuggestion[]
): Promise<void> {
  try {
    const triggerSummaries = suggestions
      .map(
        (s, i) =>
          `${i + 1}. [${s.severity?.toUpperCase()}] ${s.triggerType}: ${s.title} — ${s.summary}`
      )
      .join("\n");

    const response = await llmGateway.chat({
      model: "gpt-4o-mini",
      maxCompletionTokens: 800,
      messages: [
        {
          role: "system",
          content:
            "You are a marine operations assistant. Given a list of triggered alerts/suggestions, produce:\n1. A brief executive summary (2-3 sentences) of the overall situation.\n2. For each item, a one-sentence actionable recommendation.\nFormat: First the executive summary, then numbered items matching the input order.\nBe concise and actionable. Use marine operations terminology.",
        },
        {
          role: "user",
          content: `The following ${suggestions.length} conditions were detected:\n${triggerSummaries}\n\nProvide the executive summary and per-item recommendations.`,
        },
      ],
      meta: {
        caller: "agent-suggestion-summarizer",
        ...(suggestions[0]?.orgId !== undefined && { orgId: suggestions[0].orgId }),
        suggestionCount: suggestions.length,
      },
    });

    const aiContent = response.content;
    if (aiContent && suggestions.length > 0) {
      const lines = aiContent.split("\n").filter((l) => l.trim());
      for (let i = 0; i < suggestions.length; i++) {
        const recLine = lines.find((l) => l.trim().startsWith(`${i + 1}.`));
        const sug = suggestions[i];
        if (recLine && sug) {
          await repo.suggestions.update(sug.id, {
            summary: `${sug.summary} AI recommendation: ${recLine.replace(/^\d+\.\s*/, "")}`,
          } as Partial<AgentSuggestion>);
        }
      }

      await repo.suggestions.create({
        orgId: suggestions[0]!.orgId,
        triggerType: "ai_summary",
        title: `AI Summary: ${suggestions.length} new conditions detected`,
        summary: aiContent,
        severity: suggestions.some((s) => s.severity === "critical") ? "critical" : "warning",
        status: "pending",
        context: { suggestionIds: suggestions.map((s) => s.id), count: suggestions.length },
      });
    }
  } catch (err) {
    logger.warn("[SuggestionEngine] AI summarization failed (non-blocking):", {
      details: err instanceof Error ? err.message : "unknown",
    });
  }
}

export async function queueSuggestionNotifications(
  orgId: string,
  suggestions: AgentSuggestion[]
): Promise<void> {
  try {
    for (const sug of suggestions) {
      if (sug.triggerType === "ai_summary") {
        continue;
      }
      await dbNotificationsStorage.createNotificationQueueItem({
        orgId,
        notificationType: "ai_suggestion",
        subject: sug.title,
        body: sug.summary,
        recipients: [],
        relatedEntityType: sug.entityType || sug.triggerType,
        relatedEntityId: sug.entityId || sug.id,
        status: "pending",
      });
    }
  } catch (err) {
    logger.warn("[SuggestionEngine] Notification queue integration failed (non-blocking):", {
      details: err instanceof Error ? err.message : "unknown",
    });
  }
}
