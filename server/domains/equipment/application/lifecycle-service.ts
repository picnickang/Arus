import type { Equipment, EquipmentDecommissionEvent, DecommissionStatus } from "@shared/schema";
import { recordAndPublish } from "../../../sync-events";
import { logger } from "../../../utils/logger.js";
import type { IEquipmentLifecycleRepository } from "../domain/ports";
import type {
  DecommissionEquipmentInput,
  ReinstateEquipmentInput,
} from "../domain/lifecycle-validation";

export class EquipmentLifecycleService {
  constructor(private readonly repo: IEquipmentLifecycleRepository) {}

  async decommissionEquipment(
    id: string,
    orgId: string,
    input: DecommissionEquipmentInput,
    userId?: string
  ): Promise<Equipment> {
    const existingEquipment = await this.repo.findActiveEquipmentById(id, orgId);
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

    const decommissionEvent = await this.repo.createDecommissionEvent(eventData);

    const updatedEquipment = await this.repo.decommissionEquipment(
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
    const existingEquipment = await this.repo.findDecommissionedEquipmentById(
      id,
      orgId
    );
    if (!existingEquipment) {
      throw new Error(`Decommissioned equipment not found: ${id}`);
    }

    if (existingEquipment.isActive === true) {
      throw new Error(`Equipment is already active: ${id}`);
    }

    const reinstatedBy = input.reinstatedBy || userId || "system";

    const updatedEquipment = await this.repo.reinstateEquipment(
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
    return this.repo.findDecommissionedEquipment(orgId);
  }

  async getDecommissionedEquipmentWithHistory(
    orgId: string
  ): Promise<Array<Equipment & { decommissionEvents: EquipmentDecommissionEvent[] }>> {
    return this.repo.findDecommissionedEquipmentWithHistory(orgId);
  }

  async getEquipmentHistory(
    equipmentId: string,
    orgId: string
  ): Promise<EquipmentDecommissionEvent[]> {
    const equipment = await this.repo.findEquipmentById(equipmentId, orgId);
    if (!equipment) {
      throw new Error(`Equipment not found: ${equipmentId}`);
    }
    return this.repo.getDecommissionHistory(equipmentId, orgId);
  }
}

