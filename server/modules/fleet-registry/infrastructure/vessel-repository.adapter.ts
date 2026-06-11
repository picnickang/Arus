import type {
  VesselRepositoryPort,
  PortCallRepositoryPort,
  DrydockWindowRepositoryPort,
} from "../domain/ports";
import type { InsertVessel, InsertPortCall, InsertDrydockWindow } from "../domain/types";
import { dbVesselStorage } from "../../../db/vessels";

export class VesselRepositoryAdapter implements VesselRepositoryPort {
  findAll(orgId?: string) {
    return dbVesselStorage.getVessels(orgId);
  }
  findById(id: string, orgId?: string) {
    return dbVesselStorage.getVessel(id, orgId);
  }
  findByName(name: string, orgId: string) {
    return dbVesselStorage.getVesselByName(name, orgId);
  }
  create(data: InsertVessel) {
    return dbVesselStorage.createVessel(data);
  }
  update(
    id: string,
    updates: import("../../../lib/widen-partial").WidenPartial<InsertVessel>,
    orgId?: string
  ) {
    return dbVesselStorage.updateVessel(id, updates, orgId);
  }
  delete(id: string, orgId?: string) {
    return dbVesselStorage.deleteVessel(id, orgId);
  }
  getFleetOverview(orgId?: string) {
    return dbVesselStorage.getFleetOverview(orgId);
  }
}

export class PortCallRepositoryAdapter implements PortCallRepositoryPort {
  findByVessel(vesselId: string, orgId: string) {
    return dbVesselStorage.getPortCalls(vesselId, orgId);
  }
  create(data: InsertPortCall) {
    return dbVesselStorage.createPortCall(data);
  }
  update(id: string, updates: Partial<InsertPortCall>, orgId: string) {
    return dbVesselStorage.updatePortCall(id, updates, orgId);
  }
  delete(id: string, orgId: string) {
    return dbVesselStorage.deletePortCall(id, orgId);
  }
}

export class DrydockWindowRepositoryAdapter implements DrydockWindowRepositoryPort {
  findByVessel(vesselId: string, orgId: string) {
    return dbVesselStorage.getDrydockWindows(vesselId, orgId);
  }
  create(data: InsertDrydockWindow) {
    return dbVesselStorage.createDrydockWindow(data);
  }
  update(id: string, updates: Partial<InsertDrydockWindow>, orgId: string) {
    return dbVesselStorage.updateDrydockWindow(id, updates, orgId);
  }
  delete(id: string, orgId: string) {
    return dbVesselStorage.deleteDrydockWindow(id, orgId);
  }
}
