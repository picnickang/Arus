export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type AlertStatus = 'new' | 'active' | 'acknowledged' | 'resolved';

export interface RulConfidenceInterval {
  lowDays: number;
  highDays: number;
}

export interface EvidenceChip {
  label: string;
  type: 'trend' | 'threshold' | 'anomaly' | 'pattern';
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
  detectedAt: string | Date;
  acknowledgedAt?: string | Date | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | Date | null;
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
    lastSeen: string | Date;
    lastSeenAgo: string;
  }>;
}

export interface ModelHealth {
  activeModelsCount: number;
  driftAlertsCount: number;
  lastTrainingDate: string | Date | null;
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

export interface CostSavingsSummary {
  totalSavings: number;
  totalDowntimePrevented: number;
  savingsByType: {
    labor: number;
    parts: number;
    downtime: number;
  };
  savingsCount: number;
  avgSavingsPerIncident: number;
  topSavings: Array<{
    workOrderId: string;
    equipmentName: string;
    savings: number;
    downtimePrevented: number;
  }>;
}

export interface MonthlySavingsTrend {
  month: string;
  totalSavings: number;
  laborSavings: number;
  partsSavings: number;
  downtimeSavings: number;
  downtimePrevented: number;
  savingsCount: number;
}

export interface EquipmentFinancials {
  totalFleetValue: number;
  totalCapitalRecovered: number;
  assetROI: number;
  totalMaintenanceSavings: number;
}

export interface TelemetryReading {
  ts: string | Date;
  sensorType: string;
  value: number;
  unit?: string;
  status: string;
}

export interface TelemetryTrend {
  equipmentId: string;
  sensorType: string;
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataPoints: number;
  lastReading: string | Date;
}

export type ScheduledTaskStatus = 'draft' | 'scheduled' | 'blocked' | 'escalated' | 'wo_created';

export type BlockReason = 
  | 'capacity' 
  | 'parts_lead_time' 
  | 'vessel_unavailable' 
  | 'telemetry_stale' 
  | 'insufficient_confidence'
  | 'scheduling_conflict';

export interface SchedulingWindow {
  earliestStart: string | Date;
  preferredDate: string | Date;
  latestFinish: string | Date;
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
  scheduledDate?: string | Date;
  assignedCrewId?: string;
  workOrderId?: string;
  createdAt: string | Date;
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
  dateRange: { start: string | Date; end: string | Date };
}
