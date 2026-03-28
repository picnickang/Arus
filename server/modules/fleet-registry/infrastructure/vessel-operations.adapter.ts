import type { VesselOperationsPort } from "../domain/ports";
import { storage } from "../../../storage";

export class VesselOperationsAdapter implements VesselOperationsPort {
  exportVessel(id: string, orgId: string) {
    return storage.exportVessel(id, orgId);
  }
  importVessel(data: any, orgId: string) {
    return storage.importVessel(data, orgId);
  }
  resetDowntime(vesselId: string, orgId: string) {
    return storage.resetVesselDowntime(vesselId, orgId);
  }
  resetOperation(vesselId: string, orgId: string) {
    return storage.resetVesselOperation(vesselId, orgId);
  }
  wipeData(vesselId: string, orgId: string) {
    return storage.wipeVesselData(vesselId, orgId);
  }
  getVesselEquipment(vesselId: string, orgId: string) {
    return storage.getVesselEquipment(vesselId, orgId);
  }
  assignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return storage.assignEquipmentToVessel(vesselId, equipmentId, orgId);
  }
  unassignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return storage.unassignEquipmentFromVessel(vesselId, equipmentId, orgId);
  }
}
