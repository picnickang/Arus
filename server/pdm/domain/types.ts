export type RiskLevel = "critical" | "high" | "medium" | "low";
export type AlertStatus = "new" | "active" | "acknowledged" | "resolved";

export interface RulConfidenceInterval {
  lowDays: number;
  highDays: number;
}

export interface EvidenceChip {
  label: string;
  type: "trend" | "threshold" | "anomaly" | "pattern";
}

export interface RiskQueueItem {
  id: string;
  vesselId: string;
  vesselName: string;
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  failureMode: string;
  severity: RiskLevel;
  rulEstimateDays: number | null;
  rulConfidenceInterval?: RulConfidenceInterval | null;
  confidence: number;
  recommendedAction: string;
  evidenceChips?: EvidenceChip[];
  trendData?: number[];
  status: AlertStatus;
  detectedAt: Date;
  acknowledgedAt?: Date | null;
  acknowledgedBy?: string | null;
  resolvedAt?: Date | null;
  workOrderId?: string | null;
}

export interface FleetHealthKpis {
  fleetHealthScore: number;
  fleetHealthChange: number;
  fleetHealthPeriod: string;
  activeAlertsTotal: number;
  criticalAlertsCount: number;
  assetsAtRisk: number;
  assetsRulUnder14Days: number;
  avoidedDowntimeHours: number;
  avoidedDowntimePeriod: string;
  maintenanceForecastCost: number;
  maintenanceForecastPeriod: string;
}

export interface TelemetryCoverage {
  onlineCount: number;
  totalCount: number;
  delayedCount: number;
  delayedEquipment: Array<{
    equipmentId: string;
    equipmentName: string;
    vesselName: string;
    lastSeen: Date;
    lastSeenAgo: string;
  }>;
}

export interface ModelHealth {
  activeModelsCount: number;
  driftAlertsCount: number;
  lastTrainingDate: Date | null;
}

export interface MaintenancePipeline {
  openWorkOrdersCount: number;
  awaitingApprovalCount: number;
  inProgressCount: number;
}

export interface AssetDetail {
  equipmentId: string;
  equipmentName: string;
  vesselId: string;
  vesselName: string;
  equipmentType: string;
  rulEstimateDays: number | null;
  rulUncertainty?: number | null;
  failureMode: string;
  confidence: number;
  recommendedActions: string[];
  evidenceCharts?: unknown[];
}

export interface PdmDashboardData {
  kpis: FleetHealthKpis;
  riskQueue: {
    new: RiskQueueItem[];
    active: RiskQueueItem[];
    resolved: RiskQueueItem[];
  };
  telemetryCoverage: TelemetryCoverage;
  modelHealth: ModelHealth;
  maintenancePipeline: MaintenancePipeline;
}

export type ScheduledTaskStatus = "draft" | "scheduled" | "blocked" | "escalated" | "wo_created";

export type BlockReason =
  | "capacity"
  | "parts_lead_time"
  | "vessel_unavailable"
  | "telemetry_stale"
  | "insufficient_confidence"
  | "scheduling_conflict";

export interface SchedulingWindow {
  earliestStart: Date;
  preferredDate: Date;
  latestFinish: Date;
}

export interface PdmScheduledTask {
  id: string;
  alertId: string;
  vesselId: string;
  vesselName: string;
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  failureMode: string;
  severity: RiskLevel;
  rulP10Days: number;
  rulP50Days: number;
  rulP90Days: number;
  confidence: number;
  schedulingWindow: SchedulingWindow;
  estimatedDowntimeHours: number;
  estimatedCost: number;
  status: ScheduledTaskStatus;
  blockReason?: BlockReason;
  blockDetails?: string;
  recommendedActions: string[];
  evidenceChips?: EvidenceChip[];
  scheduledDate?: Date;
  assignedCrewId?: string;
  workOrderId?: string;
  createdAt: Date;
}

export interface ScheduleKpis {
  tasksScheduledThisWeek: number;
  scheduledDateRange: string;
  unassignedHighRiskCount: number;
  unassignedUrgency: string;
  expectedDowntimeForecastHours: number;
  expectedDowntimeForecastCost: number;
  forecastPeriod: string;
  avoidedDowntimeHours: number;
  avoidedDowntimeCost: number;
  avoidedPeriod: string;
}

export interface PdmScheduleData {
  kpis: ScheduleKpis;
  scheduledTasks: PdmScheduledTask[];
  blockedTasks: PdmScheduledTask[];
  vessels: Array<{ id: string; name: string }>;
  dateRange: { start: Date; end: Date };
}
