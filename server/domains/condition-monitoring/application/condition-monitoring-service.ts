/**
 * Condition Monitoring Application Service
 * CRUD orchestration over the IConditionMonitoringRepository port plus the
 * derived condition-assessment generation use case (constructor DI).
 */

import type { IConditionMonitoringRepository } from "../domain/ports";
import type {
  OilAnalysis,
  InsertOilAnalysis,
  WearParticleAnalysis,
  InsertWearParticleAnalysis,
  ConditionMonitoring,
  InsertConditionMonitoring,
  OilChangeRecord,
  InsertOilChangeRecord,
  GenerateAssessmentInput,
} from "../domain/types";

/** Thrown when an input analysis referenced by assessment generation is absent. */
export class ConditionResourceNotFoundError extends Error {
  constructor(public readonly resource: string) {
    super(`${resource} not found`);
    this.name = "ConditionResourceNotFoundError";
  }
}

export class ConditionMonitoringService {
  constructor(private readonly repository: IConditionMonitoringRepository) {}

  // ===== Oil analyses =====
  getOilAnalyses(orgId?: string, equipmentId?: string): Promise<OilAnalysis[]> {
    return this.repository.getOilAnalyses(orgId, equipmentId);
  }
  getOilAnalysis(id: string, orgId?: string): Promise<OilAnalysis | undefined> {
    return this.repository.getOilAnalysis(id, orgId);
  }
  createOilAnalysis(analysis: InsertOilAnalysis): Promise<OilAnalysis> {
    return this.repository.createOilAnalysis(analysis);
  }
  updateOilAnalysis(
    id: string,
    analysis: Partial<InsertOilAnalysis>,
    orgId?: string
  ): Promise<OilAnalysis> {
    return this.repository.updateOilAnalysis(id, analysis, orgId);
  }
  deleteOilAnalysis(id: string, orgId?: string): Promise<void> {
    return this.repository.deleteOilAnalysis(id, orgId);
  }

  // ===== Wear particle analyses =====
  getWearParticleAnalyses(
    orgId?: string,
    equipmentId?: string
  ): Promise<WearParticleAnalysis[]> {
    return this.repository.getWearParticleAnalyses(orgId, equipmentId);
  }
  getWearParticleAnalysis(
    id: string,
    orgId?: string
  ): Promise<WearParticleAnalysis | undefined> {
    return this.repository.getWearParticleAnalysis(id, orgId);
  }
  createWearParticleAnalysis(
    analysis: InsertWearParticleAnalysis
  ): Promise<WearParticleAnalysis> {
    return this.repository.createWearParticleAnalysis(analysis);
  }
  updateWearParticleAnalysis(
    id: string,
    analysis: Partial<InsertWearParticleAnalysis>,
    orgId?: string
  ): Promise<WearParticleAnalysis> {
    return this.repository.updateWearParticleAnalysis(id, analysis, orgId);
  }
  deleteWearParticleAnalysis(id: string, orgId?: string): Promise<void> {
    return this.repository.deleteWearParticleAnalysis(id, orgId);
  }

  // ===== Condition monitoring records =====
  getConditionMonitoringRecords(
    orgId?: string,
    equipmentId?: string
  ): Promise<ConditionMonitoring[]> {
    return this.repository.getConditionMonitoringRecords(orgId, equipmentId);
  }
  getConditionMonitoringRecord(
    id: string,
    orgId?: string
  ): Promise<ConditionMonitoring | undefined> {
    return this.repository.getConditionMonitoringRecord(id, orgId);
  }
  createConditionMonitoringRecord(
    record: InsertConditionMonitoring
  ): Promise<ConditionMonitoring> {
    return this.repository.createConditionMonitoringRecord(record);
  }

  // ===== Oil change records =====
  getOilChangeRecords(orgId?: string, equipmentId?: string): Promise<OilChangeRecord[]> {
    return this.repository.getOilChangeRecords(orgId, equipmentId);
  }
  createOilChangeRecord(record: InsertOilChangeRecord): Promise<OilChangeRecord> {
    return this.repository.createOilChangeRecord(record);
  }

  // ===== Latest condition data =====
  async getLatestConditionData(equipmentId: string, orgId?: string) {
    const [latestOil, latestWear, conditionRecords, lastOilChange] = await Promise.all([
      this.repository.getLatestOilAnalysis(equipmentId, orgId),
      this.repository.getLatestWearParticleAnalysis(equipmentId, orgId),
      this.repository.getConditionMonitoringRecords(orgId, equipmentId),
      this.repository.getLatestOilChangeRecord(equipmentId, orgId),
    ]);
    return {
      oilAnalysis: latestOil,
      wearAnalysis: latestWear,
      conditionAssessment: conditionRecords[0] ?? null,
      lastOilChange: lastOilChange ?? null,
    };
  }

  // ===== Derived: generate a condition assessment from analyses =====
  async generateAssessment(input: GenerateAssessmentInput): Promise<ConditionMonitoring> {
    const oilAnalysis = await this.repository.getOilAnalysis(input.oilAnalysisId);
    if (!oilAnalysis) {
      throw new ConditionResourceNotFoundError("Oil analysis");
    }

    let wearAnalysis: WearParticleAnalysis | undefined;
    if (input.wearAnalysisId) {
      wearAnalysis = await this.repository.getWearParticleAnalysis(input.wearAnalysisId);
      if (!wearAnalysis) {
        throw new ConditionResourceNotFoundError("Wear particle analysis");
      }
    }

    const { generateConditionAssessment } = await import("../../../condition-monitoring.js");
    const assessmentData = generateConditionAssessment(
      oilAnalysis,
      wearAnalysis,
      input.vibrationScore
    );
    return this.repository.createConditionMonitoringRecord(assessmentData);
  }
}
