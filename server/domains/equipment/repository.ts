import type { Equipment, InsertEquipment, EquipmentHealth } from "@shared/schema-runtime";
import { storage } from "../../storage";

/**
 * Equipment Repository
 * Handles all data access for equipment domain
 */
export class EquipmentRepository {
  async findAll(orgId: string): Promise<Equipment[]> {
    return storage.getEquipmentRegistry(orgId);
  }

  async findById(equipmentId: string, orgId: string): Promise<Equipment | undefined> {
    return storage.getEquipment(orgId, equipmentId);
  }

  async create(data: InsertEquipment): Promise<Equipment> {
    return storage.createEquipment(data);
  }

  async update(id: string, data: Partial<InsertEquipment>, orgId?: string): Promise<Equipment> {
    return storage.updateEquipment(id, data, orgId);
  }

  async delete(id: string, orgId?: string): Promise<void> {
    return storage.deleteEquipment(id, orgId);
  }

  async getHealth(
    orgId?: string,
    vesselId?: string,
    equipmentId?: string
  ): Promise<EquipmentHealth[]> {
    return storage.getEquipmentHealth(orgId, vesselId, equipmentId);
  }

  async disassociateVessel(equipmentId: string, orgId: string): Promise<void> {
    const equipment = await this.findById(equipmentId, orgId);
    if (!equipment) {
      throw new Error("Equipment not found");
    }
    await this.update(equipmentId, { vesselId: null }, orgId);
  }

  async getSensorCoverage(equipmentId: string, orgId: string) {
    return storage.getEquipmentSensorCoverage(equipmentId, orgId);
  }

  async setupSensors(equipmentId: string, orgId: string) {
    return storage.setupEquipmentSensors(equipmentId, orgId);
  }

  async getCompatibleParts(equipmentId: string, orgId: string) {
    return storage.getCompatibleParts(equipmentId, orgId);
  }

  async getSuggestedParts(equipmentId: string, orgId: string) {
    return storage.getSuggestedParts(equipmentId, orgId);
  }

  async getEquipmentWithSensorIssues(orgId: string) {
    return storage.getEquipmentWithSensorIssues(orgId);
  }
}

// Export singleton instance
export const equipmentRepository = new EquipmentRepository();
