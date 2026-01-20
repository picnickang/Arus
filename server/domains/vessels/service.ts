import type { SelectVessel, InsertVessel } from "@shared/schema-runtime";
import { vesselsRepository } from "./repository";
import { recordAndPublish } from "../../sync-events";
import { mqttReliableSync } from "../../mqtt-reliable-sync";
import { incrementVesselOperation } from "../../observability";
import { logger } from "../../utils/logger.js";

/**
 * Vessels Service
 * Handles business logic, orchestration, and event publishing
 */
export class VesselsService {
  async listVessels(orgId?: string): Promise<SelectVessel[]> {
    return vesselsRepository.findAll(orgId);
  }

  async getVesselById(id: string): Promise<SelectVessel | undefined> {
    return vesselsRepository.findById(id);
  }

  async createVessel(data: InsertVessel, userId?: string): Promise<SelectVessel> {
    const vessel = await vesselsRepository.create(data);

    // Record vessel operation metric (enhanced observability)
    incrementVesselOperation("create", vessel.id);

    // Publish events
    await recordAndPublish("vessel", vessel.id, "create", vessel, userId);

    mqttReliableSync.publishVesselChange("create", vessel).catch((err) => {
      logger.error("VesselsService", "Failed to publish vessel create to MQTT", err);
    });

    return vessel;
  }

  async updateVessel(
    id: string,
    data: Partial<InsertVessel>,
    userId?: string
  ): Promise<SelectVessel> {
    const vessel = await vesselsRepository.update(id, data);

    // Publish events
    await recordAndPublish("vessel", vessel.id, "update", vessel, userId);

    mqttReliableSync.publishVesselChange("update", vessel).catch((err) => {
      logger.error("VesselsService", "Failed to publish vessel update to MQTT", err);
    });

    return vessel;
  }

  async deleteVessel(
    id: string,
    deleteEquipment: boolean,
    orgId: string,
    userId?: string
  ): Promise<void> {
    await vesselsRepository.delete(id, deleteEquipment, orgId);

    // Publish events
    await recordAndPublish("vessel", id, "delete", { id }, userId);

    mqttReliableSync.publishVesselChange("delete", { id } as SelectVessel).catch((err) => {
      logger.error("VesselsService", "Failed to publish vessel delete to MQTT", err);
    });
  }

  async exportVessel(id: string, orgId: string) {
    return vesselsRepository.exportVessel(id, orgId);
  }

  async importVessel(data: any, orgId: string, userId?: string) {
    const result = await vesselsRepository.importVessel(data, orgId);

    // Publish events
    if (result.vessel) {
      await recordAndPublish("vessel", result.vessel.id, "create", result.vessel, userId);
    }

    return result;
  }

  async resetDowntime(vesselId: string, orgId: string, userId?: string) {
    const result = await vesselsRepository.resetDowntime(vesselId, orgId);

    // Publish events
    await recordAndPublish("vessel", vesselId, "update", { id: vesselId }, userId);

    return result;
  }

  async resetOperation(vesselId: string, orgId: string, userId?: string) {
    const result = await vesselsRepository.resetOperation(vesselId, orgId);

    // Publish events
    await recordAndPublish("vessel", vesselId, "update", { id: vesselId }, userId);

    return result;
  }

  async wipeData(vesselId: string, orgId: string, userId?: string) {
    const result = await vesselsRepository.wipeData(vesselId, orgId);

    // Publish events
    await recordAndPublish("vessel", vesselId, "update", { id: vesselId }, userId);

    return result;
  }

  async getVesselEquipment(vesselId: string, orgId: string) {
    return vesselsRepository.getVesselEquipment(vesselId, orgId);
  }

  async assignEquipment(vesselId: string, equipmentId: string, orgId: string, userId?: string) {
    const result = await vesselsRepository.assignEquipment(vesselId, equipmentId, orgId);

    // Publish events
    await recordAndPublish(
      "equipment",
      equipmentId,
      "update",
      { id: equipmentId, vesselId },
      userId
    );

    return result;
  }

  async unassignEquipment(vesselId: string, equipmentId: string, orgId: string, userId?: string) {
    const result = await vesselsRepository.unassignEquipment(vesselId, equipmentId, orgId);

    // Publish events
    await recordAndPublish(
      "equipment",
      equipmentId,
      "update",
      { id: equipmentId, vesselId: null },
      userId
    );

    return result;
  }
}

// Export singleton instance
export const vesselsService = new VesselsService();
