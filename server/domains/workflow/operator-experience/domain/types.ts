export type OperatorRole =
  | "chief_engineer"
  | "second_engineer"
  | "deck_officer"
  | "technician"
  | "fleet_manager"
  | "superintendent"
  | "system_admin";

export type ExperiencePillar =
  | "clarity"
  | "trust"
  | "actionability"
  | "speed"
  | "offline_resilience"
  | "learning_loop";

export type ExperienceSeverity = "good" | "watch" | "risk" | "critical";

export interface RoleExperienceProfile {
  role: OperatorRole;
  label: string;
  primaryGoal: string;
  dailyQuestions: string[];
  successDefinition: string;
  preferredPrimaryAction: string;
}

export interface OperatorExperienceInput {
  role: OperatorRole;
  currentPath?: string;
  deviceClass?: "mobile" | "tablet" | "desktop" | "unknown";
  connectionState?: "online" | "offline" | "degraded" | "unknown";
  statedGoal?: string;
}

export interface OperatorExperienceSignalSnapshot {
  attentionItems: number;
  criticalItems: number;
  blockedItems: number;
  waitingOnParts: number;
  readyForCloseout: number;
  handoverNotes: number;
  offlinePending: number;
  conflicts: number;
  pdmRisks: number;
  dataQualityWarnings: number;
  lastSyncAt?: string | null;
  sourceHealth: Record<string, "ok" | "failed" | "not_configured">;
}

export interface ExperiencePillarScore {
  pillar: ExperiencePillar;
  label: string;
  score: number;
  severity: ExperienceSeverity;
  reason: string;
  recommendedImprovement: string;
}

export interface OperatorNextAction {
  id: string;
  label: string;
  description: string;
  href: string;
  priority: "routine" | "soon" | "urgent" | "immediate";
  businessImpact: "trust" | "conversion" | "retention" | "safety" | "uptime";
}

export interface ExperienceFrictionPoint {
  id: string;
  title: string;
  symptom: string;
  affectedGoal: string;
  fix: string;
  priority: "low" | "medium" | "high" | "critical";
}

export interface ExperienceTrustSignal {
  id: string;
  label: string;
  description: string;
  status: "present" | "needs_attention" | "missing";
  evidence: string;
}

export interface ExperienceSolutionMap {
  detectRisk: string;
  explainRisk: string;
  assignAction: string;
  completeWork: string;
  captureProof: string;
  updateHandover: string;
  learnFromOutcome: string;
  reportImpact: string;
}

export interface OperatorExperienceBrief {
  generatedAt: string;
  orgId: string;
  role: RoleExperienceProfile;
  currentPath?: string;
  statedGoal?: string;
  executiveSummary: string;
  userQuestionsAnswered: Array<{
    question: string;
    answer: string;
  }>;
  signals: OperatorExperienceSignalSnapshot;
  pillarScores: ExperiencePillarScore[];
  nextActions: OperatorNextAction[];
  frictionPoints: ExperienceFrictionPoint[];
  trustSignals: ExperienceTrustSignal[];
  solutionMap: ExperienceSolutionMap;
  successMetric: string;
}

export interface OperatorExperienceEvent {
  eventType:
    | "page_view"
    | "cta_click"
    | "workflow_started"
    | "workflow_completed"
    | "friction_reported"
    | "trust_signal_viewed";
  role?: OperatorRole;
  path?: string;
  label?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export interface RecordedOperatorExperienceEvent extends OperatorExperienceEvent {
  id: string;
  orgId: string;
  occurredAt: string;
}
