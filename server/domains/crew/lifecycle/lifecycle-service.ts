import type { SelectCrew, SelectCrewEmploymentHistory } from "@shared/schema";
import { crewLifecycleRepository } from "./lifecycle-repository";
import { recordAndPublish } from "../../../sync-events";
import { mqttReliableSync } from "../../../mqtt-reliable-sync";
import { logger } from "../../../utils/logger.js";
import type {
  RetireCrewInput,
  CancelCrewContractInput,
  ReinstateCrewInput,
  UpdateEmploymentHistoryInput,
} from "./lifecycle-validation";

export class CrewLifecycleService {
  async retireCrew(
    id: string,
    orgId: string,
    input: RetireCrewInput,
    userId?: string
  ): Promise<SelectCrew> {
    const existingCrew = await crewLifecycleRepository.findActiveCrewById(id, orgId);
    if (!existingCrew) {
      throw new Error(`Active crew member not found: ${id}`);
    }

    if (existingCrew.active === false) {
      throw new Error(`Crew member is already inactive: ${id}`);
    }

    const terminationDate = new Date();

    await crewLifecycleRepository.createEmploymentHistory({
      orgId: existingCrew.orgId,
      crewId: existingCrew.id,
      startDate: existingCrew.startDate ?? existingCrew.createdAt ?? new Date(),
      endDate: terminationDate,
      terminationType: "retired",
      terminationNotes: input.notes,
      contractPenalty: null,
      vesselId: existingCrew.vesselId,
      rank: existingCrew.rank,
    });

    const updatedCrew = await crewLifecycleRepository.terminateCrew(
      id,
      orgId,
      "retired",
      terminationDate,
      input.notes
    );

    await recordAndPublish("crew", id, "update", updatedCrew, userId);
    mqttReliableSync.publishCrewChange("update", updatedCrew).catch((err) => {
      logger.error("CrewLifecycleService", "Failed to publish crew retire to MQTT", err);
    });

    return updatedCrew;
  }

  async cancelCrewContract(
    id: string,
    orgId: string,
    input: CancelCrewContractInput,
    userId?: string
  ): Promise<SelectCrew> {
    const existingCrew = await crewLifecycleRepository.findActiveCrewById(id, orgId);
    if (!existingCrew) {
      throw new Error(`Active crew member not found: ${id}`);
    }

    if (existingCrew.active === false) {
      throw new Error(`Crew member is already inactive: ${id}`);
    }

    const terminationDate = new Date();
    const penalty = input.applyPenalty ? existingCrew.contractPenalty : null;

    await crewLifecycleRepository.createEmploymentHistory({
      orgId: existingCrew.orgId,
      crewId: existingCrew.id,
      startDate: existingCrew.startDate ?? existingCrew.createdAt ?? new Date(),
      endDate: terminationDate,
      terminationType: "cancelled",
      terminationNotes: input.notes,
      contractPenalty: penalty,
      vesselId: existingCrew.vesselId,
      rank: existingCrew.rank,
    });

    const updatedCrew = await crewLifecycleRepository.terminateCrew(
      id,
      orgId,
      "cancelled",
      terminationDate,
      input.notes
    );

    await recordAndPublish("crew", id, "update", updatedCrew, userId);
    mqttReliableSync.publishCrewChange("update", updatedCrew).catch((err) => {
      logger.error("CrewLifecycleService", "Failed to publish crew cancel to MQTT", err);
    });

    return updatedCrew;
  }

  async reinstateCrew(
    id: string,
    orgId: string,
    input: ReinstateCrewInput,
    userId?: string
  ): Promise<SelectCrew> {
    const existingCrew = await crewLifecycleRepository.findFormerCrewById(id, orgId);
    if (!existingCrew) {
      throw new Error(`Former crew member not found: ${id}`);
    }

    if (existingCrew.active === true) {
      throw new Error(`Crew member is already active: ${id}`);
    }

    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const reinstatedBy = input.reinstatedBy || userId;

    const updatedCrew = await crewLifecycleRepository.reinstateCrew(
      id,
      orgId,
      startDate,
      reinstatedBy
    );

    await recordAndPublish("crew", id, "update", updatedCrew, userId);
    mqttReliableSync.publishCrewChange("update", updatedCrew).catch((err) => {
      logger.error("CrewLifecycleService", "Failed to publish crew reinstate to MQTT", err);
    });

    return updatedCrew;
  }

  async getFormerCrew(orgId: string): Promise<SelectCrew[]> {
    return crewLifecycleRepository.findFormerCrew(orgId);
  }

  async getFormerCrewWithHistory(orgId: string) {
    return crewLifecycleRepository.findFormerCrewWithHistory(orgId);
  }

  async getEmploymentHistory(
    crewId: string,
    orgId: string
  ): Promise<SelectCrewEmploymentHistory[]> {
    return crewLifecycleRepository.getEmploymentHistory(crewId, orgId);
  }

  async updateEmploymentHistory(
    id: string,
    orgId: string,
    input: UpdateEmploymentHistoryInput
  ): Promise<SelectCrewEmploymentHistory> {
    const existing = await crewLifecycleRepository.findEmploymentHistoryById(id, orgId);
    if (!existing) {
      throw new Error(`Employment history record not found: ${id}`);
    }

    const updateData: Record<string, unknown> = {};
    if (input.startDate) {
      updateData.startDate = new Date(input.startDate);
    }
    if (input.endDate) {
      updateData.endDate = new Date(input.endDate);
    }
    if (input.terminationType !== undefined) {
      updateData.terminationType = input.terminationType;
    }
    if (input.terminationNotes !== undefined) {
      updateData.terminationNotes = input.terminationNotes;
    }
    if (input.contractPenalty !== undefined) {
      updateData.contractPenalty = input.contractPenalty;
    }
    if (input.vesselId !== undefined) {
      updateData.vesselId = input.vesselId;
    }
    if (input.rank !== undefined) {
      updateData.rank = input.rank;
    }

    return crewLifecycleRepository.updateEmploymentHistory(id, orgId, updateData);
  }

  async deleteEmploymentHistory(id: string, orgId: string): Promise<void> {
    const existing = await crewLifecycleRepository.findEmploymentHistoryById(id, orgId);
    if (!existing) {
      throw new Error(`Employment history record not found: ${id}`);
    }

    const deleted = await crewLifecycleRepository.deleteEmploymentHistory(id, orgId);
    if (!deleted) {
      throw new Error(`Failed to delete employment history record: ${id}`);
    }
  }

  async deleteFormerCrew(id: string, orgId: string, userId?: string): Promise<void> {
    const existingCrew = await crewLifecycleRepository.findFormerCrewById(id, orgId);
    if (!existingCrew) {
      throw new Error(`Former crew member not found: ${id}`);
    }

    const deleted = await crewLifecycleRepository.deleteFormerCrew(id, orgId);
    if (!deleted) {
      throw new Error(`Failed to delete former crew member: ${id}`);
    }

    await recordAndPublish("crew", id, "delete", existingCrew, userId);
    mqttReliableSync.publishCrewChange("delete", existingCrew).catch((err) => {
      logger.error("CrewLifecycleService", "Failed to publish crew delete to MQTT", err);
    });
  }

  async bulkDeleteFormerCrew(ids: string[], orgId: string, userId?: string): Promise<number> {
    const formerCrewMembers = await Promise.all(
      ids.map((id) => crewLifecycleRepository.findFormerCrewById(id, orgId))
    );

    const validIds = formerCrewMembers
      .filter((c): c is SelectCrew => c !== undefined)
      .map((c) => c.id);

    if (validIds.length === 0) {
      return 0;
    }

    const deletedCount = await crewLifecycleRepository.bulkDeleteCrew(validIds, orgId);

    for (const crew of formerCrewMembers.filter((c): c is SelectCrew => c !== undefined)) {
      await recordAndPublish("crew", crew.id, "delete", crew, userId);
    }

    return deletedCount;
  }
}

export const crewLifecycleService = new CrewLifecycleService();
