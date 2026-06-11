import type { Equipment } from "@shared/schema";
import type {
  Vessel,
  InsertVessel,
  Vessel as SelectVessel,
  PortCall,
  InsertPortCall,
  DrydockWindow,
  InsertDrydockWindow,
  FleetOverview,
  VesselImportResult,
  WipeDataResult,
} from "./types";

export interface VesselRepositoryPort {
  findAll(orgId?: string): Promise<Vessel[]>;
  findById(id: string, orgId?: string): Promise<Vessel | undefined>;
  findByName(name: string, orgId: string): Promise<Vessel | undefined>;
  create(data: InsertVessel): Promise<Vessel>;
  update(
    id: string,
    updates: import("../../../lib/widen-partial").WidenPartial<InsertVessel>,
    orgId?: string
  ): Promise<Vessel>;
  delete(id: string, orgId?: string): Promise<void>;
  getFleetOverview(orgId?: string): Promise<FleetOverview>;
}

export interface PortCallRepositoryPort {
  findByVessel(vesselId: string, orgId: string): Promise<PortCall[]>;
  create(data: InsertPortCall): Promise<PortCall>;
  update(id: string, updates: Partial<InsertPortCall>, orgId: string): Promise<PortCall>;
  delete(id: string, orgId: string): Promise<void>;
}

export interface DrydockWindowRepositoryPort {
  findByVessel(vesselId: string, orgId: string): Promise<DrydockWindow[]>;
  create(data: InsertDrydockWindow): Promise<DrydockWindow>;
  update(id: string, updates: Partial<InsertDrydockWindow>, orgId: string): Promise<DrydockWindow>;
  delete(id: string, orgId: string): Promise<void>;
}

export interface VesselOperationsPort {
  exportVessel(id: string, orgId: string): Promise<Record<string, unknown>>;
  importVessel(data: Record<string, unknown>, orgId: string): Promise<VesselImportResult>;
  resetDowntime(vesselId: string, orgId: string): Promise<SelectVessel>;
  resetOperation(vesselId: string, orgId: string): Promise<SelectVessel>;
  wipeData(vesselId: string, orgId: string): Promise<WipeDataResult>;
  getVesselEquipment(vesselId: string, orgId: string): Promise<Equipment[]>;
  assignEquipment(vesselId: string, equipmentId: string, orgId: string): Promise<Equipment>;
  unassignEquipment(vesselId: string, equipmentId: string, orgId: string): Promise<void>;
}

export interface EventPublisherPort {
  publish(
    entity: string,
    entityId: string,
    action: string,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<void>;
  publishVesselMqtt(action: string, vessel: Vessel | { id: string }): void;
}
