/**
 * Condition Monitoring Infrastructure - Repository Adapter
 * Implements IConditionMonitoringRepository by delegating to
 * dbConditionMonitoringStorage. The only layer touching the storage subpackage.
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
} from "@shared/schema";
import { dbConditionMonitoringStorage } from "../../../db/condition-monitoring/index.js";

export class ConditionMonitoringRepositoryAdapter implements IConditionMonitoringRepository {
  getOilAnalyses(orgId?: string, equipmentId?: string): Promise<OilAnalysis[]> {
    return dbConditionMonitoringStorage.getOilAnalyses(orgId, equipmentId);
  }
  getOilAnalysis(id: string, orgId?: string): Promise<OilAnalysis | undefined> {
    return dbConditionMonitoringStorage.getOilAnalysis(id, orgId);
  }
  createOilAnalysis(analysis: InsertOilAnalysis): Promise<OilAnalysis> {
    return dbConditionMonitoringStorage.createOilAnalysis(analysis);
  }
  updateOilAnalysis(
    id: string,
    analysis: Partial<InsertOilAnalysis>,
    orgId?: string
  ): Promise<OilAnalysis> {
    return dbConditionMonitoringStorage.updateOilAnalysis(id, analysis, orgId);
  }
  deleteOilAnalysis(id: string, orgId?: string): Promise<void> {
    return dbConditionMonitoringStorage.deleteOilAnalysis(id, orgId);
  }
  getLatestOilAnalysis(equipmentId: string, orgId?: string): Promise<OilAnalysis | undefined> {
    return dbConditionMonitoringStorage.getLatestOilAnalysis(equipmentId, orgId);
  }

  getWearParticleAnalyses(
    orgId?: string,
    equipmentId?: string
  ): Promise<WearParticleAnalysis[]> {
    return dbConditionMonitoringStorage.getWearParticleAnalyses(orgId, equipmentId);
  }
  getWearParticleAnalysis(
    id: string,
    orgId?: string
  ): Promise<WearParticleAnalysis | undefined> {
    return dbConditionMonitoringStorage.getWearParticleAnalysis(id, orgId);
  }
  createWearParticleAnalysis(
    analysis: InsertWearParticleAnalysis
  ): Promise<WearParticleAnalysis> {
    return dbConditionMonitoringStorage.createWearParticleAnalysis(analysis);
  }
  updateWearParticleAnalysis(
    id: string,
    analysis: Partial<InsertWearParticleAnalysis>,
    orgId?: string
  ): Promise<WearParticleAnalysis> {
    return dbConditionMonitoringStorage.updateWearParticleAnalysis(id, analysis, orgId);
  }
  deleteWearParticleAnalysis(id: string, orgId?: string): Promise<void> {
    return dbConditionMonitoringStorage.deleteWearParticleAnalysis(id, orgId);
  }
  getLatestWearParticleAnalysis(
    equipmentId: string,
    orgId?: string
  ): Promise<WearParticleAnalysis | undefined> {
    return dbConditionMonitoringStorage.getLatestWearParticleAnalysis(equipmentId, orgId);
  }

  getConditionMonitoringRecords(
    orgId?: string,
    equipmentId?: string
  ): Promise<ConditionMonitoring[]> {
    return dbConditionMonitoringStorage.getConditionMonitoringRecords(orgId, equipmentId);
  }
  getConditionMonitoringRecord(
    id: string,
    orgId?: string
  ): Promise<ConditionMonitoring | undefined> {
    return dbConditionMonitoringStorage.getConditionMonitoringRecord(id, orgId);
  }
  createConditionMonitoringRecord(
    record: InsertConditionMonitoring
  ): Promise<ConditionMonitoring> {
    return dbConditionMonitoringStorage.createConditionMonitoringRecord(record);
  }

  getOilChangeRecords(orgId?: string, equipmentId?: string): Promise<OilChangeRecord[]> {
    return dbConditionMonitoringStorage.getOilChangeRecords(orgId, equipmentId);
  }
  createOilChangeRecord(record: InsertOilChangeRecord): Promise<OilChangeRecord> {
    return dbConditionMonitoringStorage.createOilChangeRecord(record);
  }
  getLatestOilChangeRecord(
    equipmentId: string,
    orgId?: string
  ): Promise<OilChangeRecord | undefined> {
    return dbConditionMonitoringStorage.getLatestOilChangeRecord(equipmentId, orgId);
  }
}

export const conditionMonitoringRepository = new ConditionMonitoringRepositoryAdapter();
