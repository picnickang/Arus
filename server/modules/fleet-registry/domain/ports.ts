import type {
  Vessel,
  InsertVessel,
  PortCall,
  InsertPortCall,
  DrydockWindow,
  InsertDrydockWindow,
  FleetOverview,
} from "./types";

export interface VesselRepositoryPort {
  findAll(orgId?: string): Promise<Vessel[]>;
  findById(id: string, orgId?: string): Promise<Vessel | undefined>;
  findByName(name: string, orgId: string): Promise<Vessel | undefined>;
  create(data: InsertVessel): Promise<Vessel>;
  update(id: string, updates: Partial<InsertVessel>, orgId?: string): Promise<Vessel>;
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
  exportVessel(id: string, orgId: string): Promise<any>;
  importVessel(data: any, orgId: string): Promise<any>;
  resetDowntime(vesselId: string, orgId: string): Promise<any>;
  resetOperation(vesselId: string, orgId: string): Promise<any>;
  wipeData(vesselId: string, orgId: string): Promise<any>;
  getVesselEquipment(vesselId: string, orgId: string): Promise<any>;
  assignEquipment(vesselId: string, equipmentId: string, orgId: string): Promise<any>;
  unassignEquipment(vesselId: string, equipmentId: string, orgId: string): Promise<any>;
}

export interface EventPublisherPort {
  publish(entity: string, entityId: string, action: string, data: any, userId?: string): Promise<void>;
  publishVesselMqtt(action: string, vessel: any): void;
}
