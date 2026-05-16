import type {
  ExperienceSolutionMap,
  OperatorExperienceBrief,
  OperatorExperienceEvent,
  OperatorExperienceInput,
  OperatorNextAction,
  OperatorRole,
  RecordedOperatorExperienceEvent,
} from "../domain/types.js";
import type {
  OperatorExperienceEventPort,
  OperatorExperienceSignalsPort,
  OperatorRoleProfilePort,
} from "../domain/ports.js";
import {
  buildTrustSignals,
  computeExperiencePillarScores,
  identifyFrictionPoints,
} from "../domain/scoring.js";

const DEFAULT_SOLUTION_MAP: ExperienceSolutionMap = {
  detectRisk: "Use Attention Inbox and PdM evidence to surface the most important risk first.",
  explainRisk: "Show why it matters, source health, confidence, and sensor/evidence context beside every recommendation.",
  assignAction: "Convert each risk into owner, ETA, priority, and one primary action.",
  completeWork: "Guide users through work order, checklist, parts, labour, downtime, and verification steps.",
  captureProof: "Require evidence, root cause, photos/notes, and supervisor verification at closeout.",
  updateHandover: "Carry unresolved risks, blockers, and ready-to-close work into watch handover.",
  learnFromOutcome: "Feed closeout, prediction correctness, failure mode, and downtime avoided back into PdM calibration.",
  reportImpact: "Summarize uptime, safety, compliance, cost, and trust impact for shore and vessel management.",
};

function roleSpecificAction(role: OperatorRole): OperatorNextAction {
  switch (role) {
    case "technician":
      return {
        id: "scan-equipment",
        label: "Scan Equipment",
        description: "Open the asset, start a checklist, add evidence, or create a defect from the equipment tag.",
        href: "/equipment-scan",
        priority: "soon",
        businessImpact: "retention",
      };
    case "deck_officer":
      return {
        id: "prepare-handover",
        label: "Prepare Handover",
        description: "Carry unresolved risks, watch notes, compliance items, and next-watch actions forward.",
        href: "/attention-inbox?view=handover",
        priority: "urgent",
        businessImpact: "safety",
      };
    case "fleet_manager":
    case "superintendent":
      return {
        id: "review-escalations",
        label: "Review Escalations",
        description: "Focus on blocked work, cost exposure, compliance risk, and vessel-level downtime impact.",
        href: "/analytics/maintenance",
        priority: "urgent",
        businessImpact: "uptime",
      };
    case "system_admin":
      return {
        id: "review-sync-health",
        label: "Review System Health",
        description: "Check sync, source health, telemetry freshness, integrations, and audit readiness.",
        href: "/system",
        priority: "soon",
        businessImpact: "trust",
      };
    case "chief_engineer":
    case "second_engineer":
    default:
      return {
        id: "open-attention-inbox",
        label: "Open Attention Inbox",
        description: "Triage high-risk machinery, blockers, overdue work, waiting parts, and closeout items.",
        href: "/attention-inbox",
        priority: "urgent",
        businessImpact: "uptime",
      };
  }
}

function buildNextActions(input: {
  role: OperatorRole;
  criticalItems: number;
  blockedItems: number;
  waitingOnParts: number;
  readyForCloseout: number;
  conflicts: number;
}): OperatorNextAction[] {
  const actions: OperatorNextAction[] = [roleSpecificAction(input.role)];

  if (input.criticalItems > 0) {
    actions.push({
      id: "critical-risk",
      label: "Resolve Critical Risk",
      description: `${input.criticalItems} critical attention item(s) need immediate evidence review and ownership.`,
      href: "/attention-inbox?queue=needs_review",
      priority: "immediate",
      businessImpact: "safety",
    });
  }

  if (input.blockedItems > 0 || input.waitingOnParts > 0) {
    actions.push({
      id: "resolve-blockers",
      label: "Resolve Blockers",
      description: "Assign owner, ETA, and escalation path for blocked or waiting-on-parts work.",
      href: "/attention-inbox?queue=blocked",
      priority: "urgent",
      businessImpact: "uptime",
    });
  }

  if (input.readyForCloseout > 0) {
    actions.push({
      id: "closeout-feedback",
      label: "Close Out With Evidence",
      description: "Capture root cause, parts, labour, downtime, supervisor verification, and PdM feedback.",
      href: "/attention-inbox?queue=ready_to_close",
      priority: "soon",
      businessImpact: "retention",
    });
  }

  if (input.conflicts > 0) {
    actions.push({
      id: "offline-conflicts",
      label: "Resolve Offline Conflicts",
      description: "Review conflicted offline changes before users lose trust in disconnected workflows.",
      href: "/offline-outbox",
      priority: "urgent",
      businessImpact: "trust",
    });
  }

  return actions.slice(0, 5);
}

export class OperatorExperienceService {
  constructor(
    private readonly signalsPort: OperatorExperienceSignalsPort,
    private readonly profilePort: OperatorRoleProfilePort,
    private readonly eventPort: OperatorExperienceEventPort
  ) {}

  async buildBrief(orgId: string, input: OperatorExperienceInput): Promise<OperatorExperienceBrief> {
    const role = this.profilePort.getProfile(input.role);
    const signals = await this.signalsPort.getSnapshot(orgId);
    const pillarScores = computeExperiencePillarScores(signals);
    const frictionPoints = identifyFrictionPoints(signals);
    const trustSignals = buildTrustSignals(signals);
    const nextActions = buildNextActions({
      role: role.role,
      criticalItems: signals.criticalItems,
      blockedItems: signals.blockedItems,
      waitingOnParts: signals.waitingOnParts,
      readyForCloseout: signals.readyForCloseout,
      conflicts: signals.conflicts,
    });

    const lowestPillar = [...pillarScores].sort((a, b) => a.score - b.score)[0];
    const executiveSummary =
      signals.attentionItems > 0
        ? `${role.label}: ${signals.attentionItems} attention item(s) are active. Prioritize ${nextActions[0]?.label.toLowerCase() ?? "the next operational action"}. Lowest UX pillar: ${lowestPillar.label}.`
        : `${role.label}: no major attention backlog is visible. Keep the workflow simple, fast, and evidence-driven.`;

    return {
      generatedAt: new Date().toISOString(),
      orgId,
      role,
      currentPath: input.currentPath,
      statedGoal: input.statedGoal,
      executiveSummary,
      userQuestionsAnswered: [
        {
          question: "Who is the user?",
          answer: `${role.label}: ${role.primaryGoal}`,
        },
        {
          question: "What are they trying to do?",
          answer: role.dailyQuestions.join(" "),
        },
        {
          question: "What main action should they take?",
          answer: nextActions[0]?.description ?? "Open the Attention Inbox and choose the highest-priority operational action.",
        },
        {
          question: "Where might they hesitate?",
          answer: frictionPoints.map((point) => point.symptom).join(" "),
        },
        {
          question: "What information builds trust?",
          answer: trustSignals.map((signal) => `${signal.label}: ${signal.evidence}`).join(" "),
        },
      ],
      signals,
      pillarScores,
      nextActions,
      frictionPoints,
      trustSignals,
      solutionMap: DEFAULT_SOLUTION_MAP,
      successMetric: role.successDefinition,
    };
  }

  listRoleProfiles() {
    return this.profilePort.listProfiles();
  }

  solutionMap(): ExperienceSolutionMap {
    return DEFAULT_SOLUTION_MAP;
  }

  recordEvent(orgId: string, event: OperatorExperienceEvent): Promise<RecordedOperatorExperienceEvent> {
    return this.eventPort.record(orgId, event);
  }

  listRecentEvents(orgId: string, limit: number): Promise<RecordedOperatorExperienceEvent[]> {
    return this.eventPort.listRecent(orgId, limit);
  }
}
