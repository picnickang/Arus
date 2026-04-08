import type { AgentBriefing, InsertAgentBriefing } from "@shared/schema";

export interface BriefingSectionItem {
  id: string;
  title: string;
  description: string;
  severity?: "info" | "warning" | "critical";
  entityType?: string;
  entityId?: string;
  linkTo?: string;
  metadata?: Record<string, unknown>;
}

export interface BriefingSection {
  key: string;
  title: string;
  icon?: string;
  items: BriefingSectionItem[];
  emptyMessage?: string;
}

export const BRIEFING_SECTION_KEYS = [
  "overnight_alerts",
  "pending_approvals",
  "maintenance_due",
  "expiring_certifications",
  "low_stock",
  "equipment_health",
] as const;

export type BriefingSectionKey = typeof BRIEFING_SECTION_KEYS[number];

export interface BriefingRepositoryPort {
  create(data: InsertAgentBriefing): Promise<AgentBriefing>;
  getById(id: string, orgId: string): Promise<AgentBriefing | null>;
  getLatest(orgId: string): Promise<AgentBriefing | null>;
  list(orgId: string, limit?: number): Promise<AgentBriefing[]>;
  listByDate(orgId: string, date: Date): Promise<AgentBriefing[]>;
  update(id: string, data: Partial<AgentBriefing>): Promise<AgentBriefing>;
}
