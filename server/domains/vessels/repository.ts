import type { SelectVessel, InsertVessel } from "@shared/schema-runtime";
import { vesselService } from "../../repositories";
import { dbEquipmentStorage } from "../../repositories";

export class VesselsRepository {
  async findAll(orgId?: string): Promise<SelectVessel[]> {
    return vesselService.getVessels(orgId);
  }

  async findById(id: string): Promise<SelectVessel | undefined> {
    return vesselService.getVessel(id);
  }

  async create(data: InsertVessel): Promise<SelectVessel> {
    return vesselService.createVessel(data);
  }

  async update(id: string, data: Partial<InsertVessel>): Promise<SelectVessel> {
    return vesselService.updateVessel(id, data);
  }

  async delete(id: string, deleteEquipment: boolean, orgId?: string): Promise<void> {
    return vesselService.deleteVessel(id, orgId);
  }

  async exportVessel(id: string, orgId: string) {
    return vesselService.exportVessel(id, orgId);
  }

  async importVessel(data: any, orgId: string) {
    return vesselService.importVessel(data, orgId);
  }

  async resetDowntime(vesselId: string, orgId: string) {
    return vesselService.resetVesselDowntime(vesselId, orgId);
  }

  async resetOperation(vesselId: string, orgId: string) {
    return vesselService.resetVesselOperation(vesselId, orgId);
  }

  async wipeData(vesselId: string, orgId: string) {
    return vesselService.wipeVesselData(vesselId, orgId);
  }

  async getVesselEquipment(vesselId: string, orgId: string) {
    return dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId);
  }

  async assignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return dbEquipmentStorage.associateEquipmentToVessel(equipmentId, vesselId, orgId);
  }

  async unassignEquipment(vesselId: string, equipmentId: string, orgId: string) {
    return dbEquipmentStorage.disassociateEquipmentFromVessel(equipmentId, orgId);
  }
}

export const vesselsRepository = new VesselsRepository();
