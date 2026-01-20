import type {
  Equipment,
  EquipmentDecommissionEvent,
  DecommissionReason,
  DecommissionStatus,
} from "@shared/schema";
import { equipmentLifecycleRepository } from "./lifecycle-repository";
import { recordAndPublish } from "../../../sync-events";
import { logger } from "../../../utils/logger.js";
import type {
  DecommissionEquipmentInput,
  ReinstateEquipmentInput,
} from "./lifecycle-validation";

export class EquipmentLifecycleService {
  async decommissionEquipment(
    id: string,
    orgId: string,
    input: DecommissionEquipmentInput,
    userId?: string
  ): Promise<Equipment> {
    const existingEquipment = await equipmentLifecycleRepository.findActiveEquipmentById(id, orgId);
    if (!existingEquipment) {
      throw new Error(`Active equipment not found: ${id}`);
    }

    if (existingEquipment.isActive === false) {
      throw new Error(`Equipment is already decommissioned: ${id}`);
    }

    const decommissionDate = new Date();
    const decommissionStatus: DecommissionStatus = input.status || "decommissioned";

    const eventData = {
      orgId,
      equipmentId: id,
      reason: input.reason,
      eventDate: decommissionDate,
      authorizedBy: input.authorizedBy || userId,
      finalCondition: input.finalCondition,
      notes: input.notes,
      saleDetails: input.saleDetails,
      disposalDetails: input.disposalDetails,
      replacementEquipmentId: input.replacementEquipmentId,
      bookValueAtRemoval: input.bookValueAtRemoval,
      residualValue: input.residualValue,
      documentationRefs: input.documentationRefs,
    };

    const decommissionEvent = await equipmentLifecycleRepository.createDecommissionEvent(eventData);

    const updatedEquipment = await equipmentLifecycleRepository.decommissionEquipment(
      id,
      orgId,
      decommissionStatus,
      decommissionDate,
      input.authorizedBy || userId || "system",
      decommissionEvent.id
    );

    await recordAndPublish("equipment", id, "update", updatedEquipment, userId);
    logger.info("EquipmentLifecycleService", `Equipment decommissioned: ${id}`, {
      reason: input.reason,
      status: decommissionStatus,
    });

    return updatedEquipment;
  }

  async reinstateEquipment(
    id: string,
    orgId: string,
    input: ReinstateEquipmentInput,
    userId?: string
  ): Promise<Equipment> {
    const existingEquipment = await equipmentLifecycleRepository.findDecommissionedEquipmentById(id, orgId);
    if (!existingEquipment) {
      throw new Error(`Decommissioned equipment not found: ${id}`);
    }

    if (existingEquipment.isActive === true) {
      throw new Error(`Equipment is already active: ${id}`);
    }

    const reinstatedBy = input.reinstatedBy || userId || "system";

    const updatedEquipment = await equipmentLifecycleRepository.reinstateEquipment(
      id,
      orgId,
      reinstatedBy
    );

    await recordAndPublish("equipment", id, "update", updatedEquipment, userId);
    logger.info("EquipmentLifecycleService", `Equipment reinstated: ${id}`, {
      reinstatedBy,
    });

    return updatedEquipment;
  }

  async getDecommissionedEquipment(orgId: string): Promise<Equipment[]> {
    return equipmentLifecycleRepository.findDecommissionedEquipment(orgId);
  }

  async getDecommissionedEquipmentWithHistory(
    orgId: string
  ): Promise<Array<Equipment & { decommissionEvents: EquipmentDecommissionEvent[] }>> {
    return equipmentLifecycleRepository.findDecommissionedEquipmentWithHistory(orgId);
  }

  async getEquipmentHistory(
    equipmentId: string,
    orgId: string
  ): Promise<EquipmentDecommissionEvent[]> {
    const equipment = await equipmentLifecycleRepository.findEquipmentById(equipmentId, orgId);
    if (!equipment) {
      throw new Error(`Equipment not found: ${equipmentId}`);
    }
    return equipmentLifecycleRepository.getDecommissionHistory(equipmentId, orgId);
  }
}

export const equipmentLifecycleService = new EquipmentLifecycleService();
