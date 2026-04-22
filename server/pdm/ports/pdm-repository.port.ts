import type {
  RiskQueueItem,
  FleetHealthKpis,
  TelemetryCoverage,
  ModelHealth,
  MaintenancePipeline,
  AssetDetail,
} from "../domain/types";

export interface VesselBasic {
  id: string;
  name: string;
}

export interface PdmRepositoryPort {
  getFleetHealthKpis(orgId: string): Promise<FleetHealthKpis>;

  getRiskQueue(orgId: string, status?: "new" | "active" | "resolved"): Promise<RiskQueueItem[]>;

  getTelemetryCoverage(orgId: string): Promise<TelemetryCoverage>;

  getModelHealth(orgId: string): Promise<ModelHealth>;

  getMaintenancePipeline(orgId: string): Promise<MaintenancePipeline>;

  getAssetDetail(orgId: string, equipmentId: string): Promise<AssetDetail | null>;

  acknowledgeRiskItem(orgId: string, itemId: string, userId: string): Promise<void>;

  createWorkOrderFromRisk(orgId: string, itemId: string, userId: string): Promise<string>;

  getActiveAlerts(
    orgId: string,
    vesselIds?: string[],
    equipmentTypes?: string[]
  ): Promise<RiskQueueItem[]>;

  getVessels(orgId: string): Promise<VesselBasic[]>;

  getEquipmentTypes(orgId: string): Promise<string[]>;
}
