export interface EquipmentRiskItem {
  id: string;
  name: string;
  vessel: string;
  vesselId: string;
  health: number;
  rul: number;
  risk: "critical" | "warning" | "low";
  status: string;
  type: string;
  prediction: string;
  confidence: number;
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
  avgHealth: number;
}

export interface FleetSummary {
  fleetHealth: number;
  vessels: FleetSummaryVessel[];
  totalEquipment: number;
  criticalCount: number;
  warningCount: number;
  healthyCount: number;
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
  health: number;
  rul: number;
  risk: "critical" | "warning" | "low";
  confidence: number;
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
}
