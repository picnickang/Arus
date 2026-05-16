export type OperatorRole =
  | "chief_engineer"
  | "second_engineer"
  | "deck_officer"
  | "technician"
  | "fleet_manager"
  | "superintendent"
  | "system_admin";

export interface RoleExperienceProfile {
  role: OperatorRole;
  label: string;
  primaryGoal: string;
  dailyQuestions: string[];
  successDefinition: string;
  preferredPrimaryAction: string;
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
  pillar: "clarity" | "trust" | "actionability" | "speed" | "offline_resilience" | "learning_loop";
  label: string;
  score: number;
  severity: "good" | "watch" | "risk" | "critical";
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
  userQuestionsAnswered: Array<{ question: string; answer: string }>;
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

export type InformationNeedCategory =
  | "risk"
  | "work"
  | "compliance"
  | "handover"
  | "inventory"
  | "system"
  | "business";

export type InformationNeedPriority = "routine" | "important" | "urgent" | "critical";
export type InformationNeedStatus = "healthy" | "watch" | "needs_attention" | "critical";
export type UxBusinessGoal = "trust" | "conversion" | "retention" | "safety" | "uptime";

export interface RoleInformationNeed {
  id: string;
  role: OperatorRole;
  category: InformationNeedCategory;
  title: string;
  userQuestion: string;
  informationNeeded: string[];
  sourceSignals: string[];
  primaryAction: string;
  route: string;
  uiPattern: string;
  trustEvidence: string[];
  businessGoal: UxBusinessGoal;
  basePriority: InformationNeedPriority;
  priority: InformationNeedPriority;
  status: InformationNeedStatus;
  reason: string;
  recommendedCta: string;
  metricValue: number | null;
}

export interface RoleInformationNeedSummary {
  generatedAt: string;
  orgId: string;
  role: OperatorRole;
  roleLabel: string;
  headline: string;
  primaryQuestion: string;
  topNeeds: RoleInformationNeed[];
  needs: RoleInformationNeed[];
  trustChecklist: string[];
  uxGuidance: {
    clarity: string;
    speed: string;
    simplicity: string;
    trust: string;
    retention: string;
  };
}
