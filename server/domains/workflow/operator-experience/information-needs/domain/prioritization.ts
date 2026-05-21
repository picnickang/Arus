import type { OperatorExperienceSignalSnapshot } from "../../domain/types.js";
import type {
  InformationNeedPriority,
  InformationNeedStatus,
  RoleInformationNeed,
  RoleInformationNeedDefinition,
} from "./types.js";

const PRIORITY_RANK: Record<InformationNeedPriority, number> = {
  routine: 0,
  important: 1,
  urgent: 2,
  critical: 3,
};

const STATUS_RANK: Record<InformationNeedStatus, number> = {
  healthy: 0,
  watch: 1,
  needs_attention: 2,
  critical: 3,
};

function priorityFromRank(rank: number): InformationNeedPriority {
  if (rank >= 3) return "critical";
  if (rank >= 2) return "urgent";
  if (rank >= 1) return "important";
  return "routine";
}

function statusFromRank(rank: number): InformationNeedStatus {
  if (rank >= 3) return "critical";
  if (rank >= 2) return "needs_attention";
  if (rank >= 1) return "watch";
  return "healthy";
}

function metric(signals: OperatorExperienceSignalSnapshot, key: string): number {
  const value = (signals as object as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sourceHealthPenalty(signals: OperatorExperienceSignalSnapshot): number {
  return Object.values(signals.sourceHealth).some((status) => status === "failed") ? 1 : 0;
}

function signalSeverity(signals: OperatorExperienceSignalSnapshot, key: string): number {
  const value = metric(signals, key);
  if (key === "criticalItems" && value > 0) return 3;
  if (key === "conflicts" && value > 0) return 3;
  if (key === "blockedItems" && value > 0) return 2;
  if (key === "waitingOnParts" && value > 0) return 2;
  if (key === "dataQualityWarnings" && value > 0) return 2;
  if (key === "pdmRisks" && value > 0) return 2;
  if (key === "readyForCloseout" && value > 0) return 1;
  if (key === "handoverNotes" && value > 0) return 1;
  if (key === "offlinePending" && value > 0) return 1;
  if (key === "attentionItems" && value > 0) return 1;
  return 0;
}

function buildReason(definition: RoleInformationNeedDefinition, signals: OperatorExperienceSignalSnapshot): string {
  const active = definition.sourceSignals
    .map((key) => ({ key, value: metric(signals, key) }))
    .filter((item) => item.value > 0);

  if (active.length === 0) {
    return "No active signal is currently pushing this need above its baseline priority.";
  }

  return active.map((item) => `${item.key}: ${item.value}`).join("; ");
}

function cta(definition: RoleInformationNeedDefinition, status: InformationNeedStatus): string {
  if (status === "critical") return `Act now: ${definition.primaryAction}`;
  if (status === "needs_attention") return `Review today: ${definition.primaryAction}`;
  if (status === "watch") return `Keep visible: ${definition.primaryAction}`;
  return definition.primaryAction;
}

export function prioritizeInformationNeed(
  definition: RoleInformationNeedDefinition,
  signals: OperatorExperienceSignalSnapshot
): RoleInformationNeed {
  const maxSignalSeverity = definition.sourceSignals.reduce(
    (max, key) => Math.max(max, signalSeverity(signals, key)),
    0
  );
  const healthPenalty = definition.category === "system" ? sourceHealthPenalty(signals) : 0;
  const statusRank = Math.max(maxSignalSeverity, healthPenalty);
  const priorityRank = Math.max(PRIORITY_RANK[definition.basePriority], statusRank);
  const primaryMetric = definition.sourceSignals.length > 0 ? metric(signals, definition.sourceSignals[0]) : null;
  const status = statusFromRank(statusRank);

  return {
    ...definition,
    priority: priorityFromRank(priorityRank),
    status,
    reason: buildReason(definition, signals),
    recommendedCta: cta(definition, status),
    metricValue: primaryMetric,
  };
}

export function sortInformationNeeds(needs: RoleInformationNeed[]): RoleInformationNeed[] {
  return [...needs].sort((a, b) => {
    const priorityDelta = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (priorityDelta !== 0) return priorityDelta;
    const statusDelta = STATUS_RANK[b.status] - STATUS_RANK[a.status];
    if (statusDelta !== 0) return statusDelta;
    return a.title.localeCompare(b.title);
  });
}
