import type {
  EquipmentRiskItem,
  FleetSummary,
  SystemDetails,
  EquipmentDetailData,
  WorkOrderSummary,
} from "./types.js";

export interface EquipmentIntelligenceRepository {
  getFleetSummary(orgId: string): Promise<FleetSummary>;
  getEquipmentRiskList(orgId: string): Promise<EquipmentRiskItem[]>;
  getEquipmentDetail(orgId: string, equipmentId: string): Promise<EquipmentDetailData | null>;
  getWorkOrdersForEquipment(orgId: string, equipmentId: string): Promise<WorkOrderSummary[]>;
  getSystemDetails(orgId: string): Promise<SystemDetails>;
}
