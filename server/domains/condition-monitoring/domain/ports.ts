/**
 * Condition Monitoring Domain - Ports
 * The concrete adapter (wrapping dbConditionMonitoringStorage) lives in
 * infrastructure/.
 */

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

export interface IConditionMonitoringRepository {
  // Oil analyses
  getOilAnalyses(orgId?: string, equipmentId?: string): Promise<OilAnalysis[]>;
  getOilAnalysis(id: string, orgId?: string): Promise<OilAnalysis | undefined>;
  createOilAnalysis(analysis: InsertOilAnalysis): Promise<OilAnalysis>;
  updateOilAnalysis(
    id: string,
    analysis: Partial<InsertOilAnalysis>,
    orgId?: string
  ): Promise<OilAnalysis>;
  deleteOilAnalysis(id: string, orgId?: string): Promise<void>;
  getLatestOilAnalysis(equipmentId: string, orgId?: string): Promise<OilAnalysis | undefined>;

  // Wear particle analyses
  getWearParticleAnalyses(orgId?: string, equipmentId?: string): Promise<WearParticleAnalysis[]>;
  getWearParticleAnalysis(
    id: string,
    orgId?: string
  ): Promise<WearParticleAnalysis | undefined>;
  createWearParticleAnalysis(
    analysis: InsertWearParticleAnalysis
  ): Promise<WearParticleAnalysis>;
  updateWearParticleAnalysis(
    id: string,
    analysis: Partial<InsertWearParticleAnalysis>,
    orgId?: string
  ): Promise<WearParticleAnalysis>;
  deleteWearParticleAnalysis(id: string, orgId?: string): Promise<void>;
  getLatestWearParticleAnalysis(
    equipmentId: string,
    orgId?: string
  ): Promise<WearParticleAnalysis | undefined>;

  // Condition monitoring records
  getConditionMonitoringRecords(
    orgId?: string,
    equipmentId?: string
  ): Promise<ConditionMonitoring[]>;
  getConditionMonitoringRecord(
    id: string,
    orgId?: string
  ): Promise<ConditionMonitoring | undefined>;
  createConditionMonitoringRecord(
    record: InsertConditionMonitoring
  ): Promise<ConditionMonitoring>;

  // Oil change records
  getOilChangeRecords(orgId?: string, equipmentId?: string): Promise<OilChangeRecord[]>;
  createOilChangeRecord(record: InsertOilChangeRecord): Promise<OilChangeRecord>;
  getLatestOilChangeRecord(
    equipmentId: string,
    orgId?: string
  ): Promise<OilChangeRecord | undefined>;
}
