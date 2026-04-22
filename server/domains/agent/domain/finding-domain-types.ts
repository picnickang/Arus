export const FINDING_TYPES = ["anomaly", "recommendation", "risk", "compliance_gap"] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const FINDING_SEVERITIES = ["info", "warning", "critical"] as const;
export type FindingSeverityLevel = (typeof FINDING_SEVERITIES)[number];

export const FINDING_STATUSES = ["new", "acknowledged", "actioned", "archived"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

const VALID_FINDING_TRANSITIONS: Record<FindingStatus, readonly FindingStatus[]> = {
  new: ["acknowledged", "actioned", "archived"],
  acknowledged: ["actioned", "archived"],
  actioned: ["archived"],
  archived: [],
};

export function isValidFindingStatusTransition(from: FindingStatus, to: FindingStatus): boolean {
  return VALID_FINDING_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface AgentFindingFilter {
  findingType?: FindingType;
  severity?: FindingSeverityLevel;
  status?: FindingStatus;
  taskId?: string;
  equipmentId?: string;
  limit?: number;
  offset?: number;
}

export interface AgentFindingRepositoryPort {
  create(
    data: import("@shared/schema").InsertAgentFinding
  ): Promise<import("@shared/schema").AgentFinding>;
  getById(id: string, orgId: string): Promise<import("@shared/schema").AgentFinding | null>;
  list(
    orgId: string,
    filter?: AgentFindingFilter
  ): Promise<import("@shared/schema").AgentFinding[]>;
  update(
    id: string,
    data: Partial<import("@shared/schema").AgentFinding>
  ): Promise<import("@shared/schema").AgentFinding>;
  listByTask(taskId: string, orgId: string): Promise<import("@shared/schema").AgentFinding[]>;
  countByStatus(orgId: string): Promise<Record<string, number>>;
}
