/**
 * Analytics/ML Storage Types
 * Predictive maintenance, insights, and ML models
 */

import type {
  PdmScoreLog,
  InsertPdmScore,
  VibrationFeature,
  InsertVibrationFeature,
  VibrationAnalysis,
  InsertVibrationAnalysis,
  RulModel,
  InsertRulModel,
  InsightSnapshot,
  InsertInsightSnapshot,
  InsightReport,
  InsertInsightReport,
  OilAnalysis,
  InsertOilAnalysis,
  WearParticleAnalysis,
  InsertWearParticleAnalysis,
  ConditionMonitoring,
  InsertConditionMonitoring,
} from "@shared/schema-runtime";

export interface PdmFilters {
  equipmentId?: string;
  vesselId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface InsightFilters {
  vesselId?: string;
  orgId?: string;
  status?: string;
}

/**
 * Analytics Storage Interface
 */
export interface IAnalyticsStorage {
  // PDM scores
  getPdmScoreLogs(filters?: PdmFilters): Promise<PdmScoreLog[]>;
  createPdmScoreLog(score: InsertPdmScore): Promise<PdmScoreLog>;
  getLatestPdmScore(equipmentId: string): Promise<PdmScoreLog | undefined>;

  // Vibration analysis
  getVibrationFeatures(equipmentId: string): Promise<VibrationFeature[]>;
  createVibrationFeature(feature: InsertVibrationFeature): Promise<VibrationFeature>;
  getVibrationAnalysis(equipmentId: string): Promise<VibrationAnalysis[]>;
  createVibrationAnalysis(analysis: InsertVibrationAnalysis): Promise<VibrationAnalysis>;

  // RUL models
  getRulModels(orgId?: string): Promise<RulModel[]>;
  getRulModel(id: string): Promise<RulModel | undefined>;
  createRulModel(model: InsertRulModel): Promise<RulModel>;
  updateRulModel(id: string, model: Partial<InsertRulModel>): Promise<RulModel>;
  deleteRulModel(id: string): Promise<void>;

  // Insights
  getInsightSnapshots(orgId: string, filters?: InsightFilters): Promise<InsightSnapshot[]>;
  getInsightSnapshot(id: string, orgId: string): Promise<InsightSnapshot | undefined>;
  createInsightSnapshot(snapshot: InsertInsightSnapshot): Promise<InsightSnapshot>;
  getInsightReports(orgId: string, filters?: InsightFilters): Promise<InsightReport[]>;
  getInsightReport(id: string, orgId: string): Promise<InsightReport | undefined>;
  createInsightReport(report: InsertInsightReport): Promise<InsightReport>;

  // Condition monitoring
  getOilAnalysis(equipmentId: string, orgId: string): Promise<OilAnalysis[]>;
  createOilAnalysis(analysis: InsertOilAnalysis): Promise<OilAnalysis>;
  getWearParticleAnalysis(equipmentId: string, orgId: string): Promise<WearParticleAnalysis[]>;
  createWearParticleAnalysis(analysis: InsertWearParticleAnalysis): Promise<WearParticleAnalysis>;
  getConditionMonitoring(equipmentId: string, orgId: string): Promise<ConditionMonitoring[]>;
  createConditionMonitoring(monitoring: InsertConditionMonitoring): Promise<ConditionMonitoring>;
}

export type {
  PdmScoreLog,
  InsertPdmScore,
  VibrationFeature,
  InsertVibrationFeature,
  VibrationAnalysis,
  InsertVibrationAnalysis,
  RulModel,
  InsertRulModel,
  InsightSnapshot,
  InsertInsightSnapshot,
  InsightReport,
  InsertInsightReport,
  OilAnalysis,
  InsertOilAnalysis,
  WearParticleAnalysis,
  InsertWearParticleAnalysis,
  ConditionMonitoring,
  InsertConditionMonitoring,
};
