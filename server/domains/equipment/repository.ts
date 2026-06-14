import type { WidenPartial } from "../../lib/widen-partial";
import type { Equipment, InsertEquipment } from "@shared/schema";
import type { EquipmentHealth } from "../../db/equipment/types.js";
// Push B4: the equipment domain owns its data access. It imports the canonical
// `dbEquipmentStorage` directly from `server/db/*`, never from the legacy
// `server/repositories.ts` proxy barrel. Cross-domain reads (sensor configs,
// parts) are injected as ports — their adapters live in composition/ so the
// equipment domain stays free of cross-domain storage coupling.
import { dbEquipmentStorage } from "../../db/equipment/index.js";
import type {
  IEquipmentSensorPort,
  IEquipmentPartsPort,
} from "../../composition/equipment-cross-domain-data";
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

  async update(
    id: string,
    data: WidenPartial<InsertEquipment>,
    orgId?: string
  ): Promise<Equipment> {
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
    await this.update(
      equipmentId,
      { vesselId: null } as object as WidenPartial<InsertEquipment>,
      orgId
    );
  }

  async getSensorCoverage(equipmentId: string, orgId: string, sensorPort: IEquipmentSensorPort) {
    const sensors = await sensorPort.getSensorConfigurations(orgId, equipmentId);
    const sensorTypes = ["temperature", "pressure", "vibration", "flow", "level"];
    const coveredTypes = new Set(sensors.map((s) => s.sensorType));
    const coverage =
      sensorTypes.length > 0 ? Math.round((coveredTypes.size / sensorTypes.length) * 100) : 0;
    return { equipmentId, orgId, sensors, coverage };
  }

  async setupSensors(equipmentId: string, orgId: string, sensorPort: IEquipmentSensorPort) {
    const equipment = await this.findById(equipmentId, orgId);
    if (!equipment) {
      throw new Error("Equipment not found");
    }
    const existing = await sensorPort.getSensorConfigurations(orgId, equipmentId);
    const existingTypes = new Set(existing.map((s) => s.sensorType));
    const sensorsToCreate = DEFAULT_SENSORS[equipment.type] || DEFAULT_SENSORS["default"] || [];
    const created: import("@shared/schema/sensors").SensorConfiguration[] = [];
    for (const sensor of sensorsToCreate) {
      if (!existingTypes.has(sensor.type)) {
        const newSensor = await sensorPort.createSensorConfiguration({
          equipmentId,
          orgId,
          sensorType: sensor.type,
          enabled: true,
          isCritical: sensor.critical,
          minValue: sensor.min,
          maxValue: sensor.max,
        });
        created.push(newSensor);
      }
    }
    return {
      equipmentId,
      equipmentType: equipment.type,
      sensorsCreated: created.length,
      sensorsSkipped: (sensorsToCreate?.length ?? 0) - created.length,
      totalSensors: existing.length + created.length,
      sensors: created.map((s) => {
        const isCritical =
          "isCritical" in s ? ((s as { isCritical?: boolean | null }).isCritical ?? null) : null;
        return {
          sensorType: s.sensorType,
          enabled: s.enabled ?? false,
          isCritical,
        };
      }),
    };
  }

  async getCompatibleParts(equipmentId: string, orgId: string, partsPort: IEquipmentPartsPort) {
    const equipment = await this.findById(equipmentId, orgId);
    if (!equipment) {
      return [];
    }
    const parts = await partsPort.getParts(orgId);
    return parts.filter((p) => {
      const eqType =
        "equipmentType" in p ? (p as { equipmentType?: string }).equipmentType : undefined;
      const eqId = "equipmentId" in p ? (p as { equipmentId?: string }).equipmentId : undefined;
      return eqType === equipment.type || eqId === equipmentId;
    });
  }

  async getSuggestedParts(equipmentId: string, orgId: string, partsPort: IEquipmentPartsPort) {
    return this.getCompatibleParts(equipmentId, orgId, partsPort);
  }

  async getEquipmentWithSensorIssues(orgId: string) {
    return dbEquipmentStorage.getEquipmentWithSensorIssues(orgId);
  }
}

export const equipmentRepository = new EquipmentRepository();
