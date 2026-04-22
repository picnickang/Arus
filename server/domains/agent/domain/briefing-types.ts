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

export type BriefingSectionKey = (typeof BRIEFING_SECTION_KEYS)[number];

export interface BriefingRepositoryPort {
  create(data: InsertAgentBriefing): Promise<AgentBriefing>;
  getById(id: string, orgId: string): Promise<AgentBriefing | null>;
  getLatestForToday(orgId: string): Promise<AgentBriefing | null>;
  list(orgId: string, limit?: number): Promise<AgentBriefing[]>;
  listByDate(orgId: string, date: Date): Promise<AgentBriefing[]>;
  update(id: string, data: Partial<AgentBriefing>): Promise<AgentBriefing>;
}

export interface AlertRecord {
  id: string | number;
  equipmentId: string;
  sensorType: string | null;
  alertType: string | null;
  message: string | null;
  value: number | null;
  threshold: number | null;
  createdAt: Date | null;
}

export interface MaintenanceDueRecord {
  id: string;
  equipmentId: string;
  scheduledDate: Date;
  maintenanceType: string | null;
  description: string | null;
}

export interface ExpiringCertRecord {
  certId: string | number;
  crewId: string;
  cert: string | null;
  expiresAt: Date;
  crewName: string | null;
}

export interface LowStockRecord {
  id: string;
  partName: string;
  quantityOnHand: number;
  minStockLevel: number;
}

export interface BriefingDataPort {
  getOvernightAlerts(orgId: string, periodStart: Date, periodEnd: Date): Promise<AlertRecord[]>;
  getMaintenanceDueToday(orgId: string): Promise<MaintenanceDueRecord[]>;
  getExpiringCertifications(orgId: string, withinDays: number): Promise<ExpiringCertRecord[]>;
  getLowStockParts(orgId: string, limit: number): Promise<LowStockRecord[]>;
}
