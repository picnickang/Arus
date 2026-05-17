// @ts-nocheck
import type { VesselOperationsPort } from "../domain/ports";
import { vesselService, dbEquipmentStorage } from "../../../repositories";

export class VesselOperationsAdapter implements VesselOperationsPort {
  exportVessel(id: string, orgId: string) {
    return vesselService.exportVessel(id, orgId);
  }
  importVessel(data: Record<string, unknown>, orgId: string) {
    return vesselService.importVessel(data, orgId);
  }
  resetDowntime(vesselId: string, orgId: string) {
    return vesselService.resetVesselDowntime(vesselId, orgId);
  }
  resetOperation(vesselId: string, orgId: string) {
    return vesselService.resetVesselOperation(vesselId, orgId);
  }
  wipeData(vesselId: string, orgId: string) {
    return vesselService.wipeVesselData(vesselId, orgId);
  }
  getVesselEquipment(vesselId: string, orgId: string) {
    return dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId || "");
  }
  assignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return dbEquipmentStorage.associateEquipmentToVessel(equipmentId, vesselId, orgId || "");
  }
  unassignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return dbEquipmentStorage.disassociateEquipmentFromVessel(equipmentId, orgId || "");
  }
}
