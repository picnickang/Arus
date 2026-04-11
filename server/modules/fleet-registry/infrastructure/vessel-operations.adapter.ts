/**
 * @todo PRE-EXISTING GAP: exportVessel, importVessel, resetVesselDowntime,
 * resetVesselOperation, wipeVesselData are defined in IStorage interface but
 * never implemented on vesselService or dbVesselStorage repos. These calls
 * would fail at runtime regardless of storage facade vs direct repo imports.
 * Same gap exists in server/domains/vessels/repository.ts.
 * Fix: Implement these methods on vesselService or dbVesselStorage.
 */
import type { VesselOperationsPort } from "../domain/ports";
import { vesselService, dbEquipmentStorage } from "../../../repositories";

export class VesselOperationsAdapter implements VesselOperationsPort {
  exportVessel(id: string, orgId: string) {
    return (vesselService as any).exportVessel(id, orgId);
  }
  importVessel(data: Record<string, unknown>, orgId: string) {
    return (vesselService as any).importVessel(data, orgId);
  }
  resetDowntime(vesselId: string, orgId: string) {
    return (vesselService as any).resetVesselDowntime(vesselId, orgId);
  }
  resetOperation(vesselId: string, orgId: string) {
    return (vesselService as any).resetVesselOperation(vesselId, orgId);
  }
  wipeData(vesselId: string, orgId: string) {
    return (vesselService as any).wipeVesselData(vesselId, orgId);
  }
  getVesselEquipment(vesselId: string, orgId: string) {
    return dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId || '');
  }
  assignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return dbEquipmentStorage.associateEquipmentToVessel(equipmentId, vesselId, orgId || '');
  }
  unassignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return dbEquipmentStorage.disassociateEquipmentFromVessel(equipmentId, orgId || '');
  }
}
