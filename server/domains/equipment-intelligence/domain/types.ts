export interface EquipmentRiskItem {
  id: string;
  name: string;
  vessel: string;
  vesselId: string;
  health: number | null;
  rul: number | null;
  risk: "critical" | "warning" | "low";
  status: string;
  type: string;
  prediction: string;
  confidence: number | null;
  trend: "declining" | "stable" | "improving";
  lastService: string | null;
  nextDue: string | null;
  telemetry: number[];
  signals: string[];
  dataAvailability: "full" | "partial" | "unavailable";
}

export interface FleetSummaryVessel {
  id: string;
  name: string;
  equipment: number;
  critical: number;
  warning: number;
  healthy: number;
  noData: number;
  avgHealth: number | null;
}

export interface FleetSummary {
  fleetHealth: number | null;
  vessels: FleetSummaryVessel[];
  totalEquipment: number;
  criticalCount: number;
  warningCount: number;
  healthyCount: number;
  noDataCount: number;
  dataStatus: "ok" | "degraded";
}

export interface SystemDetails {
  modelStatus: string;
  lastTraining: string;
  inferenceLatency: string;
  dataQuality: string;
  sensorsOnline: string;
}

export interface EquipmentIntelligenceData {
  fleet: FleetSummary;
  equipment: EquipmentRiskItem[];
  systemDetails?: SystemDetails;
}

export interface EquipmentDetailData {
  id: string;
  name: string;
  vessel: string;
  vesselId: string;
  type: string;
  health: number | null;
  rul: number | null;
  risk: "critical" | "warning" | "low";
  confidence: number | null;
  prediction: string;
  trend: "declining" | "stable" | "improving";
  signals: string[];
  telemetry: number[];
  lastService: string | null;
  nextDue: string | null;
  workOrders: WorkOrderSummary[];
  dataAvailability: "full" | "partial" | "unavailable";
}

export interface WorkOrderSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  assignedCrewId: string | null;
  assignmentStatus: string | null;
  assignmentResponseReason: string | null;
  assignmentRespondedAt: string | null;
}

export interface ServiceOrderSummary {
  id: string;
  title: string;
  status: string;
  vendorName: string | null;
  eta: string | null;
  createdAt: string;
}

export interface DiagnosticRunSummary {
  id: string;
  analysisType: string;
  status: string;
  summary: string | null;
  createdAt: string;
}

export interface ActivityTimelineEvent {
  id: string;
  type: "work_order" | "prediction" | "telemetry_anomaly" | "procurement" | "diagnostic";
  title: string;
  description: string | null;
  timestamp: string;
  severity?: "critical" | "warning" | "info";
}

export interface OperationalContext {
  vesselStatus: string;
  nextPort: string | null;
  nextPortEta: string | null;
  partsAvailability: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  maintenanceWindow: string | null;
}

export interface NeedsActionItem {
  id: string;
  type: "work_order" | "prediction" | "parts" | "compliance" | "alert";
  title: string;
  urgency: "high" | "medium" | "low";
  link: string;
}

export interface ActiveAnomaly {
  id: number;
  anomalyType: string | null;
  sensorType: string;
  severity: string;
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

export interface EquipmentHubAggregate {
  id: string;
  name: string;
  vessel: string;
  vesselId: string;
  type: string;
  /** null = no PdM score recorded yet — never fabricate a healthy 100. */
  health: number | null;
  /** null = no failure prediction yet — never fabricate a 365-day RUL. */
  rul: number | null;
  risk: "critical" | "warning" | "low";
  /** null = no prediction to derive confidence from (was a fake 85%). */
  confidence: number | null;
  prediction: string;
  trend: "declining" | "stable" | "improving";
  signals: string[];
  telemetry: number[];
  lastService: string | null;
  nextDue: string | null;
  dataAvailability: "full" | "partial" | "unavailable";
  assessment: string;
  recommendedAction: string;
  operationalContext: OperationalContext;
  needsAction: NeedsActionItem[];
  activeAnomaly: ActiveAnomaly | null;
  workOrders: WorkOrderSummary[];
  serviceOrders: ServiceOrderSummary[];
  diagnosticRuns: DiagnosticRunSummary[];
  activityTimeline: ActivityTimelineEvent[];
}
