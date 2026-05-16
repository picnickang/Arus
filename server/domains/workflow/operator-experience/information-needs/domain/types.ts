import type { OperatorRole } from "../../domain/types.js";

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

export interface RoleInformationNeedDefinition {
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
}

export interface RoleInformationNeed extends RoleInformationNeedDefinition {
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
