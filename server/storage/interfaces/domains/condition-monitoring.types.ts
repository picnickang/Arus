/**
 * Condition Monitoring Storage Interface - Oil Analysis, Vibration, Wear Particles
 * Part of IStorage modularization for improved maintainability
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
  VibrationFeature,
  InsertVibrationFeature,
  VibrationAnalysis,
  WeibullEstimate,
  DowntimeEvent,
  InsertDowntimeEvent,
  PartFailureHistory,
  InsertPartFailureHistory,
  IndustryBenchmark,
  InsertIndustryBenchmark,
} from "@shared/schema";

/**
 * Condition monitoring storage operations for oil, vibration, and wear analysis
 */
export interface IConditionMonitoringStorage {
  // Oil Analysis
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

  // Wear Particle Analysis
  getWearParticleAnalyses(orgId?: string, equipmentId?: string): Promise<WearParticleAnalysis[]>;
  getWearParticleAnalysis(id: string, orgId?: string): Promise<WearParticleAnalysis | undefined>;
  createWearParticleAnalysis(analysis: InsertWearParticleAnalysis): Promise<WearParticleAnalysis>;
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

  // Condition Monitoring Assessments
  getConditionMonitoringAssessments(
    orgId?: string,
    equipmentId?: string
  ): Promise<ConditionMonitoring[]>;
  getConditionMonitoringAssessment(
    id: string,
    orgId?: string
  ): Promise<ConditionMonitoring | undefined>;
  createConditionMonitoringAssessment(
    assessment: InsertConditionMonitoring
  ): Promise<ConditionMonitoring>;
  updateConditionMonitoringAssessment(
    id: string,
    assessment: Partial<InsertConditionMonitoring>,
    orgId?: string
  ): Promise<ConditionMonitoring>;
  deleteConditionMonitoringAssessment(id: string, orgId?: string): Promise<void>;
  getLatestConditionAssessment(
    equipmentId: string,
    orgId?: string
  ): Promise<ConditionMonitoring | undefined>;

  // Oil Change Records
  getOilChangeRecords(equipmentId?: string, orgId?: string): Promise<OilChangeRecord[]>;
  getOilChangeRecord(id: string, orgId?: string): Promise<OilChangeRecord | undefined>;
  createOilChangeRecord(record: InsertOilChangeRecord): Promise<OilChangeRecord>;
  updateOilChangeRecord(
    id: string,
    record: Partial<InsertOilChangeRecord>,
    orgId?: string
  ): Promise<OilChangeRecord>;
  deleteOilChangeRecord(id: string, orgId?: string): Promise<void>;
  getLatestOilChange(equipmentId: string, orgId?: string): Promise<OilChangeRecord | undefined>;

  // Vibration Features
  getVibrationFeatures(equipmentId?: string, orgId?: string): Promise<VibrationFeature[]>;
  createVibrationFeature(feature: InsertVibrationFeature): Promise<VibrationFeature>;
  getVibrationHistory(
    equipmentId: string,
    hours?: number,
    orgId?: string
  ): Promise<VibrationFeature[]>;

  // Vibration Analysis
  createVibrationAnalysis(
    analysis: Omit<VibrationAnalysis, "id" | "createdAt">
  ): Promise<VibrationAnalysis>;
  getVibrationAnalysisHistory(
    orgId: string,
    equipmentId: string,
    limit?: number
  ): Promise<VibrationAnalysis[]>;

  // Weibull Analysis
  createWeibullAnalysis(
    analysis: Omit<WeibullEstimate, "id" | "createdAt">
  ): Promise<WeibullEstimate>;
  getWeibullAnalysisHistory(
    equipmentId: string,
    orgId: string,
    limit?: number
  ): Promise<WeibullEstimate[]>;

  // Downtime Events
  getDowntimeEvents(
    orgId?: string,
    workOrderId?: string,
    equipmentId?: string,
    vesselId?: string
  ): Promise<DowntimeEvent[]>;
  getDowntimeEvent(id: string, orgId?: string): Promise<DowntimeEvent | undefined>;
  createDowntimeEvent(event: InsertDowntimeEvent): Promise<DowntimeEvent>;
  updateDowntimeEvent(
    id: string,
    event: Partial<InsertDowntimeEvent>,
    orgId?: string
  ): Promise<DowntimeEvent>;
  deleteDowntimeEvent(id: string, orgId?: string): Promise<void>;
  getDowntimeByPeriod(startDate: Date, endDate: Date, orgId?: string): Promise<DowntimeEvent[]>;
  calculateTotalDowntime(
    equipmentId: string,
    startDate?: Date,
    endDate?: Date,
    orgId?: string
  ): Promise<number>;

  // Part Failure History
  getPartFailureHistory(
    orgId?: string,
    partId?: string,
    equipmentId?: string,
    supplierId?: string
  ): Promise<PartFailureHistory[]>;
  getPartFailure(id: string, orgId?: string): Promise<PartFailureHistory | undefined>;
  createPartFailure(failure: InsertPartFailureHistory): Promise<PartFailureHistory>;
  updatePartFailure(
    id: string,
    failure: Partial<InsertPartFailureHistory>,
    orgId?: string
  ): Promise<PartFailureHistory>;
  deletePartFailure(id: string, orgId?: string): Promise<void>;
  getPartFailureRate(partId: string, days?: number, orgId?: string): Promise<number>;
  getSupplierDefectRate(supplierId: string, days?: number, orgId?: string): Promise<number>;
  updateSupplierQualityMetrics(supplierId: string, orgId?: string): Promise<void>;

  // Industry Benchmarks
  getIndustryBenchmarks(
    equipmentType?: string,
    manufacturer?: string,
    model?: string
  ): Promise<IndustryBenchmark[]>;
  getIndustryBenchmark(id: string): Promise<IndustryBenchmark | undefined>;
  createIndustryBenchmark(benchmark: InsertIndustryBenchmark): Promise<IndustryBenchmark>;
  updateIndustryBenchmark(
    id: string,
    benchmark: Partial<InsertIndustryBenchmark>
  ): Promise<IndustryBenchmark>;
  deleteIndustryBenchmark(id: string): Promise<void>;
  findMatchingBenchmark(
    equipmentType: string,
    manufacturer?: string,
    model?: string
  ): Promise<IndustryBenchmark | undefined>;
}
