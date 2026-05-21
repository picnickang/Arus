import type { Equipment, InsertEquipment } from "@shared/schema";
import type { EquipmentHealth } from "../../db/equipment/types.js";
// Push B4: the equipment domain owns its data access. It imports the
// canonical `dbEquipmentStorage` (and the two cross-domain storages it
// genuinely needs) directly from `server/db/*`, never from the legacy
// `server/repositories.ts` proxy barrel. This keeps the equipment
// domain free of the service-locator pattern.
import { dbEquipmentStorage } from "../../db/equipment/index.js";
import { dbSensorsStorage } from "../../db/sensors/index.js";
import { dbInventoryStorage } from "../../db/inventory/index.js";
import { DEFAULT_SENSORS } from "./service/types.js";

export class EquipmentRepository {
  async findAll(orgId: string): Promise<Equipment[]> {
    return dbEquipmentStorage.getEquipmentRegistry(orgId);
  }

  async findById(equipmentId: string, orgId: string): Promise<Equipment | undefined> {
    return dbEquipmentStorage.getEquipment(orgId, equipmentId);
  }

  async create(data: InsertEquipment): Promise<Equipment> {
    return dbEquipmentStorage.createEquipment(data);
  }

  async update(id: string, data: Partial<InsertEquipment>, orgId?: string): Promise<Equipment> {
    return dbEquipmentStorage.updateEquipment(id, data, orgId || "");
  }

  async delete(id: string, orgId?: string): Promise<void> {
    return dbEquipmentStorage.deleteEquipment(id, orgId);
  }

  async getHealth(
    orgId?: string,
    vesselId?: string,
    equipmentId?: string
  ): Promise<EquipmentHealth[]> {
    return dbEquipmentStorage.getEquipmentHealth(orgId || "", { vesselId, equipmentId });
  }

  async disassociateVessel(equipmentId: string, orgId: string): Promise<void> {
    const equipment = await this.findById(equipmentId, orgId);
    if (!equipment) {
      throw new Error("Equipment not found");
    }
    await this.update(equipmentId, { vesselId: null } as object as Partial<InsertEquipment>, orgId);
  }

  async getSensorCoverage(equipmentId: string, orgId: string) {
    const sensors = await dbSensorsStorage.getSensorConfigurations(orgId, equipmentId);
    const sensorTypes = ["temperature", "pressure", "vibration", "flow", "level"];
    const coveredTypes = new Set(sensors.map((s) => s.sensorType));
    const coverage =
      sensorTypes.length > 0 ? Math.round((coveredTypes.size / sensorTypes.length) * 100) : 0;
    return { equipmentId, orgId, sensors, coverage };
  }

  async setupSensors(equipmentId: string, orgId: string) {
    const equipment = await this.findById(equipmentId, orgId);
    if (!equipment) {
      throw new Error("Equipment not found");
    }
    const existing = await dbSensorsStorage.getSensorConfigurations(orgId, equipmentId);
    const existingTypes = new Set(existing.map((s) => s.sensorType));
    const sensorsToCreate = DEFAULT_SENSORS[equipment.type] || DEFAULT_SENSORS.default;
    const created: any[] = [];
    for (const sensor of sensorsToCreate) {
      if (!existingTypes.has(sensor.type)) {
        const newSensor = await dbSensorsStorage.createSensorConfiguration({
          equipmentId,
          orgId,
          sensorType: sensor.type,
          enabled: true,
          isCritical: sensor.critical,
          minValue: sensor.min,
          maxValue: sensor.max,
        } as object as Parameters<typeof dbSensorsStorage.createSensorConfiguration>[0]);
        created.push(newSensor);
      }
    }
    return {
      equipmentId,
      equipmentType: equipment.type,
      sensorsCreated: created.length,
      sensorsSkipped: sensorsToCreate.length - created.length,
      totalSensors: existing.length + created.length,
      sensors: created.map((s) => ({
        sensorType: s.sensorType,
        enabled: s.enabled,
        isCritical: s.isCritical,
      })),
    };
  }

  async getCompatibleParts(equipmentId: string, orgId: string) {
    const equipment = await this.findById(equipmentId, orgId);
    if (!equipment) {
      return [];
    }
    const parts = await dbInventoryStorage.getParts(orgId);
    return parts.filter(
      (p: any) => p.equipmentType === equipment.type || p.equipmentId === equipmentId
    );
  }

  async getSuggestedParts(equipmentId: string, orgId: string) {
    return this.getCompatibleParts(equipmentId, orgId);
  }

  async getEquipmentWithSensorIssues(orgId: string) {
    return dbEquipmentStorage.getEquipmentWithSensorIssues(orgId);
  }
}

export const equipmentRepository = new EquipmentRepository();
