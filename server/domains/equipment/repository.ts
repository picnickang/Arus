import type { Equipment, InsertEquipment, EquipmentHealth } from "@shared/schema-runtime";
import { dbEquipmentStorage } from "../../repositories";

export class EquipmentRepository {
  async findAll(orgId: string): Promise<Equipment[]> {
    return dbEquipmentStorage.getEquipmentRegistry(orgId);
  }

  async findById(equipmentId: string, orgId: string): Promise<Equipment | undefined> {
    return dbEquipmentStorage.getEquipment(orgId, equipmentId);
  }

  async create(data: InsertEquipment): Promise<Equipment> {
    return dbEquipmentStorage.registerEquipment(data);
  }

  async update(id: string, data: Partial<InsertEquipment>, orgId?: string): Promise<Equipment> {
    return dbEquipmentStorage.updateEquipmentRegistry(id, data, orgId || '');
  }

  async delete(id: string, orgId?: string): Promise<void> {
    return dbEquipmentStorage.deleteEquipment(id, orgId);
  }

  async getHealth(
    orgId?: string,
    vesselId?: string,
    equipmentId?: string
  ): Promise<EquipmentHealth[]> {
    return dbEquipmentStorage.getEquipmentHealth(orgId || '', { vesselId, equipmentId });
  }

  async disassociateVessel(equipmentId: string, orgId: string): Promise<void> {
    const equipment = await this.findById(equipmentId, orgId);
    if (!equipment) {
      throw new Error("Equipment not found");
    }
    await this.update(equipmentId, { vesselId: null }, orgId);
  }

  async getSensorCoverage(equipmentId: string, orgId: string) {
    return { equipmentId, orgId, sensors: [], coverage: 0 };
  }

  async setupSensors(equipmentId: string, orgId: string) {
    return { equipmentId, orgId, configured: [] };
  }

  async getCompatibleParts(equipmentId: string, orgId: string) {
    return [];
  }

  async getSuggestedParts(equipmentId: string, orgId: string) {
    return [];
  }

  async getEquipmentWithSensorIssues(orgId: string) {
    return dbEquipmentStorage.getEquipmentWithSensorIssues(orgId);
  }
}

export const equipmentRepository = new EquipmentRepository();
