import type { Equipment, InsertEquipment, EquipmentHealth } from "@shared/schema-runtime";
import { dbEquipmentStorage, dbSensorsStorage, dbInventoryStorage } from "../../repositories";

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
    const sensors = await dbSensorsStorage.getSensorConfigurations(orgId, equipmentId);
    const sensorTypes = ['temperature', 'pressure', 'vibration', 'flow', 'level'];
    const coveredTypes = new Set(sensors.map(s => s.sensorType));
    const coverage = sensorTypes.length > 0 ? Math.round((coveredTypes.size / sensorTypes.length) * 100) : 0;
    return { equipmentId, orgId, sensors, coverage };
  }

  async setupSensors(equipmentId: string, orgId: string) {
    const existing = await dbSensorsStorage.getSensorConfigurations(orgId, equipmentId);
    return { equipmentId, orgId, configured: existing };
  }

  async getCompatibleParts(equipmentId: string, orgId: string) {
    const equipment = await this.findById(equipmentId, orgId);
    if (!equipment) return [];
    const parts = await dbInventoryStorage.getParts(orgId);
    return parts.filter((p: any) => p.equipmentType === (equipment as any).type || p.equipmentId === equipmentId);
  }

  async getSuggestedParts(equipmentId: string, orgId: string) {
    return this.getCompatibleParts(equipmentId, orgId);
  }

  async getEquipmentWithSensorIssues(orgId: string) {
    return dbEquipmentStorage.getEquipmentWithSensorIssues(orgId);
  }
}

export const equipmentRepository = new EquipmentRepository();
