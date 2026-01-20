import type { SelectVessel, InsertVessel } from "@shared/schema-runtime";
import { storage } from "../../storage";

/**
 * Vessels Repository
 * Handles all data access for vessels domain
 */
export class VesselsRepository {
  async findAll(orgId?: string): Promise<SelectVessel[]> {
    return storage.getVessels(orgId);
  }

  async findById(id: string): Promise<SelectVessel | undefined> {
    return storage.getVessel(id);
  }

  async create(data: InsertVessel): Promise<SelectVessel> {
    return storage.createVessel(data);
  }

  async update(id: string, data: Partial<InsertVessel>): Promise<SelectVessel> {
    return storage.updateVessel(id, data);
  }

  async delete(id: string, deleteEquipment: boolean, orgId?: string): Promise<void> {
    return storage.deleteVessel(id, deleteEquipment, orgId);
  }

  async exportVessel(id: string, orgId: string) {
    return storage.exportVessel(id, orgId);
  }

  async importVessel(data: any, orgId: string) {
    return storage.importVessel(data, orgId);
  }

  async resetDowntime(vesselId: string, orgId: string) {
    return storage.resetVesselDowntime(vesselId, orgId);
  }

  async resetOperation(vesselId: string, orgId: string) {
    return storage.resetVesselOperation(vesselId, orgId);
  }

  async wipeData(vesselId: string, orgId: string) {
    return storage.wipeVesselData(vesselId, orgId);
  }

  async getVesselEquipment(vesselId: string, orgId: string) {
    return storage.getVesselEquipment(vesselId, orgId);
  }

  async assignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return storage.assignEquipmentToVessel(vesselId, equipmentId, orgId);
  }

  async unassignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return storage.unassignEquipmentFromVessel(vesselId, equipmentId, orgId);
  }
}

// Export singleton instance
export const vesselsRepository = new VesselsRepository();
