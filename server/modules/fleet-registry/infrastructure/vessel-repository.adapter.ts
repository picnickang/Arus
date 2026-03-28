import type {
  VesselRepositoryPort,
  PortCallRepositoryPort,
  DrydockWindowRepositoryPort,
} from "../domain/ports";
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
  create(data: any) {
    return dbVesselStorage.createVessel(data);
  }
  update(id: string, updates: any, orgId?: string) {
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
  create(data: any) {
    return dbVesselStorage.createPortCall(data);
  }
  update(id: string, updates: any, orgId: string) {
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
  create(data: any) {
    return dbVesselStorage.createDrydockWindow(data);
  }
  update(id: string, updates: any, orgId: string) {
    return dbVesselStorage.updateDrydockWindow(id, updates, orgId);
  }
  delete(id: string, orgId: string) {
    return dbVesselStorage.deleteDrydockWindow(id, orgId);
  }
}
