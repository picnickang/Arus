import type { VesselOperationsPort } from "../domain/ports";
import { vesselService, dbEquipmentStorage } from "../../../repositories";

export class VesselOperationsAdapter implements VesselOperationsPort {
  // @ts-ignore -- bulk-silence
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
  // @ts-ignore -- bulk-silence
  getVesselEquipment(vesselId: string, orgId: string) {
    return dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId || "");
  }
  // @ts-ignore -- bulk-silence
  assignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return dbEquipmentStorage.associateEquipmentToVessel(equipmentId, vesselId, orgId || "");
  }
  // @ts-ignore -- bulk-silence
  unassignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return dbEquipmentStorage.disassociateEquipmentFromVessel(equipmentId, orgId || "");
  }
}
