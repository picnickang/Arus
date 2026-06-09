import type {
  EquipmentRecord,
  RegistrySummaryRecord,
  VesselIntelligenceAlertRecord,
  VesselIntelligenceWorkOrderRecord,
  VesselRecord,
} from "./data";
import type { FleetSectionEquipmentSummary } from "./fleet-section-equipment-model";

export type FleetTriageSeverity = "critical" | "warning" | "healthy" | "missing";

export interface FleetTriageInputs {
  vessels: VesselRecord[];
  equipment: EquipmentRecord[];
  workOrders: VesselIntelligenceWorkOrderRecord[];
  alerts: VesselIntelligenceAlertRecord[];
  summariesByVesselId?: Record<string, RegistrySummaryRecord | undefined>;
  now?: Date;
}

export interface FleetTriageVessel {
  vesselId: string;
  vesselName: string;
  vesselClassLabel: string;
  conditionLabel: string;
  onlineStatusLabel: string;
  lastHeartbeatLabel: string;
  healthScore: number | null;
  status: FleetTriageSeverity;
  sideElevationStatus: string;
  topIssue: string;
  topIssueKind: "alert" | "work_order" | "equipment" | "data" | "none";
  actionLabel: string;
  actionHref: string;
  sectionLabel: string;
  equipmentLabel: string;
  ownerLabel: string;
  dueLabel: string;
  activeAlerts: number;
  overdueWorkOrders: number;
  openWorkOrders: number;
  linkedEquipment: number;
  hasRegistrySummary: boolean;
  sectionEquipmentSummary: FleetSectionEquipmentSummary[];
}

export interface FleetQueueMetric {
  id: string;
  label: string;
  value: number;
  severity: FleetTriageSeverity;
  href: string;
}

export interface FleetKpiCard {
  id: string;
  label: string;
  value: string;
  trendLabel: string;
  severity: FleetTriageSeverity;
}

export interface FleetMapMarker {
  vesselId: string;
  vesselName: string;
  status: FleetTriageSeverity;
  x: number;
  y: number;
  href: string;
}

export interface FleetTriageViewModel {
  vessels: FleetTriageVessel[];
  priorityVesselId: string;
  queue: FleetQueueMetric[];
  kpis: FleetKpiCard[];
  markers: FleetMapMarker[];
  actionRows: FleetTriageVessel[];
  dataFreshnessPercent: number | null;
  hasData: boolean;
}
