import type {
  EquipmentRiskItem,
  FleetSummary,
  SystemDetails,
  EquipmentDetailData,
  WorkOrderSummary,
  EquipmentHubAggregate,
  ServiceOrderSummary,
  DiagnosticRunSummary,
  ActivityTimelineEvent,
} from "./types.js";

export interface EquipmentIntelligenceRepository {
  getFleetSummary(orgId: string): Promise<FleetSummary>;
  getEquipmentRiskList(orgId: string): Promise<EquipmentRiskItem[]>;
  getEquipmentDetail(orgId: string, equipmentId: string): Promise<EquipmentDetailData | null>;
  getWorkOrdersForEquipment(orgId: string, equipmentId: string): Promise<WorkOrderSummary[]>;
  getSystemDetails(orgId: string): Promise<SystemDetails>;
}

export interface EquipmentHubRepository {
  getHubAggregate(orgId: string, equipmentId: string): Promise<EquipmentHubAggregate | null>;
  getServiceOrdersForEquipment(orgId: string, equipmentId: string): Promise<ServiceOrderSummary[]>;
  getDiagnosticRuns(orgId: string, equipmentId: string): Promise<DiagnosticRunSummary[]>;
  saveDiagnosticRun(orgId: string, equipmentId: string, analysisType: string, results: unknown, summary: string): Promise<DiagnosticRunSummary>;
  getActivityTimeline(orgId: string, equipmentId: string): Promise<ActivityTimelineEvent[]>;
}
