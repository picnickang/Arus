import type { AgentSuggestion } from "@shared/schema";
import type {
  OutcomeRecordInput,
  EffectivenessSummary,
  OutcomeRecordPort,
  OutcomeCategory,
  PredictionFeedbackPort,
} from "../domain/ports";
import { OUTCOME_CATEGORIES } from "../domain/ports";
import type { AgentRepositoryPort } from "../domain/ports";
import { logger } from "../../../utils/logger";

const LOG_CTX = "OutcomeTrackingService";

export class OutcomeTrackingService implements OutcomeRecordPort {
  constructor(
    private repo: AgentRepositoryPort,
    private predictionFeedback?: PredictionFeedbackPort,
  ) {}

  async recordOutcome(
    input: OutcomeRecordInput,
    newStatus: "acted" | "dismissed" | "deferred",
  ): Promise<AgentSuggestion> {
    if (input.outcome !== null && !OUTCOME_CATEGORIES.includes(input.outcome as OutcomeCategory)) {
      throw new Error(`Invalid outcome category: ${input.outcome}. Valid values: ${OUTCOME_CATEGORIES.join(", ")}`);
    }

    const existing = await this.repo.suggestions.getById(input.suggestionId);
    if (!existing) {
      throw new Error("Suggestion not found");
    }
    if (existing.orgId !== input.orgId) {
      throw new Error("Suggestion not found");
    }

    const ALLOWED_FROM = ["pending", "new"];
    if (!ALLOWED_FROM.includes(existing.status)) {
      throw new Error(`Cannot transition from '${existing.status}' to '${newStatus}'. Only pending/new suggestions can be acted on.`);
    }

    const updateData: Partial<AgentSuggestion> = {
      status: newStatus,
      actedOn: newStatus === "acted",
      outcome: input.outcome ?? null,
      outcomeReason: input.outcomeReason ?? null,
      outcomeAt: new Date(),
      outcomeBy: input.outcomeBy,
    };

    if (
      existing.triggerType === "high_risk_prediction" &&
      existing.context &&
      typeof existing.context === "object"
    ) {
      const ctx = existing.context as Record<string, unknown>;
      const prediction = ctx.prediction as Record<string, unknown> | undefined;
      if (prediction?.id) {
        updateData.linkedPredictionId = prediction.id as string;
      }
    }

    const result = await this.repo.suggestions.update(input.suggestionId, updateData);

    if (updateData.linkedPredictionId && this.predictionFeedback) {
      await this.linkPredictionFeedback(existing, input, newStatus);
    }

    return result;
  }

  private async linkPredictionFeedback(
    suggestion: AgentSuggestion,
    input: OutcomeRecordInput,
    status: "acted" | "dismissed" | "deferred",
  ): Promise<void> {
    if (!this.predictionFeedback) return;

    const ctx = suggestion.context as Record<string, unknown> | null;
    const prediction = (ctx?.prediction as Record<string, unknown>) || {};
    const predictionId = prediction.id ? parseInt(String(prediction.id), 10) : 0;
    if (!predictionId || isNaN(predictionId)) return;

    const equipmentId = (suggestion.entityId || prediction.equipmentId || "") as string;
    if (!equipmentId) return;

    const isAccurate = status === "acted" && input.outcome === "useful";

    await this.predictionFeedback.recordFeedback({
      orgId: suggestion.orgId,
      predictionId,
      equipmentId,
      userId: input.outcomeBy || "system",
      feedbackType: `suggestion_${status}`,
      isAccurate,
      comments: input.outcomeReason || `Suggestion ${status} with outcome: ${input.outcome}`,
    });

    logger.info(LOG_CTX, `Linked prediction feedback for prediction ${predictionId}`);
  }

  async getEffectiveness(orgId: string, days = 30): Promise<EffectivenessSummary> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const resolved = await this.repo.suggestions.listResolved(orgId, since);

    const actedCount = resolved.filter((s) => s.status === "acted").length;
    const dismissedCount = resolved.filter((s) => s.status === "dismissed").length;
    const deferredCount = resolved.filter((s) => s.status === "deferred").length;
    const totalResolved = resolved.length;

    const acceptanceRate =
      totalResolved > 0 ? Math.round((actedCount / totalResolved) * 100) : 0;
    const dismissalRate =
      totalResolved > 0 ? Math.round((dismissedCount / totalResolved) * 100) : 0;

    const reasonCounts = new Map<string, number>();
    for (const s of resolved) {
      if (s.status === "dismissed" && s.outcomeReason) {
        reasonCounts.set(
          s.outcomeReason,
          (reasonCounts.get(s.outcomeReason) || 0) + 1,
        );
      }
    }
    const topDismissalReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const outcomeCounts: Record<string, number> = {};
    for (const s of resolved) {
      if (s.outcome) {
        outcomeCounts[s.outcome] = (outcomeCounts[s.outcome] || 0) + 1;
      }
    }

    return {
      totalResolved,
      actedCount,
      dismissedCount,
      deferredCount,
      acceptanceRate,
      dismissalRate,
      topDismissalReasons,
      outcomeCounts,
    };
  }
}
