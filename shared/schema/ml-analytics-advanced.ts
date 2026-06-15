/**
 * Schema ML Analytics Advanced - Validation, Feedback, Vibration, and RUL
 *
 * Advanced ML tables including model performance validation, prediction feedback,
 * vibration analysis, RUL models, Weibull estimates, and PdM baselines.
 */

import { createInsertSchema, z } from "./base";
import {
  modelPerformanceValidations,
  predictionFeedback,
  vibrationFeatures,
  rulModels,
  rulFitHistory,
  vibrationAnalysis,
  weibullEstimates,
  pdmBaseline,
  pdmAlerts,
} from "./ml-analytics-advanced/validation-vibration-pdm";
import {
  realTimePredictions,
  featureImportances,
  sensorFusionSnapshots,
  acousticEvents,
  modelDeployments,
  llmBudgetConfigs,
  retrainingTriggers,
} from "./ml-analytics-advanced/realtime-retraining";
import {
  digitalTwins,
  modelRegistry,
  mlModelAccuracyHistory,
  predictionDataQuality,
  inferenceRuns,
  predictionExplanations,
  modelDriftMetrics,
  predictionOutcomes,
} from "./ml-analytics-advanced/registry-runtime";

export {
  modelPerformanceValidations,
  predictionFeedback,
  vibrationFeatures,
  rulModels,
  rulFitHistory,
  vibrationAnalysis,
  weibullEstimates,
  pdmBaseline,
  pdmAlerts,
};
export {
  realTimePredictions,
  featureImportances,
  sensorFusionSnapshots,
  acousticEvents,
  modelDeployments,
  llmBudgetConfigs,
  retrainingTriggers,
};
export {
  digitalTwins,
  modelRegistry,
  mlModelAccuracyHistory,
  predictionDataQuality,
  inferenceRuns,
  predictionExplanations,
  modelDriftMetrics,
  predictionOutcomes,
};

// Insert schemas
export const insertInferenceRunSchema = createInsertSchema(inferenceRuns).omit({ id: true });
export const insertPredictionExplanationSchema = createInsertSchema(predictionExplanations).omit({
  id: true,
  createdAt: true,
});
export const insertModelDriftMetricSchema = createInsertSchema(modelDriftMetrics).omit({
  id: true,
  computedAt: true,
});
export const insertModelPerformanceValidationSchema = createInsertSchema(
  modelPerformanceValidations
).omit({ id: true, createdAt: true });
export const insertPredictionFeedbackSchema = createInsertSchema(predictionFeedback).omit({
  id: true,
  createdAt: true,
});
export const insertVibrationFeatureSchema = createInsertSchema(vibrationFeatures).omit({
  id: true,
  createdAt: true,
});
export const insertRulModelSchema = createInsertSchema(rulModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRulFitHistorySchema = createInsertSchema(rulFitHistory).omit({ id: true });
export const insertVibrationAnalysisSchema = createInsertSchema(vibrationAnalysis).omit({
  id: true,
  createdAt: true,
});
export const insertWeibullEstimateSchema = createInsertSchema(weibullEstimates).omit({
  id: true,
  createdAt: true,
});
export const insertPdmBaselineSchema = createInsertSchema(pdmBaseline).omit({
  id: true,
  updatedAt: true,
});
export const insertPdmAlertSchema = createInsertSchema(pdmAlerts).omit({ id: true, at: true });
export const insertRealTimePredictionSchema = createInsertSchema(realTimePredictions).omit({
  id: true,
});
export const insertFeatureImportanceSchema = createInsertSchema(featureImportances).omit({
  id: true,
});
export const insertSensorFusionSnapshotSchema = createInsertSchema(sensorFusionSnapshots).omit({
  id: true,
});
export const insertAcousticEventSchema = createInsertSchema(acousticEvents).omit({ id: true });
export const insertModelDeploymentSchema = createInsertSchema(modelDeployments).omit({ id: true });
export const insertLlmBudgetConfigSchema = createInsertSchema(llmBudgetConfigs).omit({ id: true });
export const insertRetrainingTriggerSchema = createInsertSchema(retrainingTriggers).omit({
  id: true,
});
export const insertDigitalTwinSchema = createInsertSchema(digitalTwins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertModelRegistrySchema = createInsertSchema(modelRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMlModelAccuracyHistorySchema = createInsertSchema(mlModelAccuracyHistory).omit({
  id: true,
});
export const insertPredictionDataQualitySchema = createInsertSchema(predictionDataQuality).omit({
  id: true,
});

// Types
export type ModelPerformanceValidation = typeof modelPerformanceValidations.$inferSelect;
export type InsertModelPerformanceValidation = z.infer<
  typeof insertModelPerformanceValidationSchema
>;
export type PredictionFeedback = typeof predictionFeedback.$inferSelect;
export type InsertPredictionFeedback = z.infer<typeof insertPredictionFeedbackSchema>;
export type VibrationFeature = typeof vibrationFeatures.$inferSelect;
export type InsertVibrationFeature = z.infer<typeof insertVibrationFeatureSchema>;
export type RulModel = typeof rulModels.$inferSelect;
export type InsertRulModel = z.infer<typeof insertRulModelSchema>;
export type RulFitHistory = typeof rulFitHistory.$inferSelect;
export type InsertRulFitHistory = z.infer<typeof insertRulFitHistorySchema>;
export type VibrationAnalysis = typeof vibrationAnalysis.$inferSelect;
export type InsertVibrationAnalysis = z.infer<typeof insertVibrationAnalysisSchema>;
export type WeibullEstimate = typeof weibullEstimates.$inferSelect;
export type InsertWeibullEstimate = z.infer<typeof insertWeibullEstimateSchema>;
export type PdmBaseline = typeof pdmBaseline.$inferSelect;
export type InsertPdmBaseline = z.infer<typeof insertPdmBaselineSchema>;
export type PdmAlert = typeof pdmAlerts.$inferSelect;
export type InsertPdmAlert = z.infer<typeof insertPdmAlertSchema>;
export type RealTimePrediction = typeof realTimePredictions.$inferSelect;
export type InsertRealTimePrediction = z.infer<typeof insertRealTimePredictionSchema>;
export type FeatureImportance = typeof featureImportances.$inferSelect;
export type InsertFeatureImportance = z.infer<typeof insertFeatureImportanceSchema>;
export type SensorFusionSnapshot = typeof sensorFusionSnapshots.$inferSelect;
export type InsertSensorFusionSnapshot = z.infer<typeof insertSensorFusionSnapshotSchema>;
export type AcousticEvent = typeof acousticEvents.$inferSelect;
export type InsertAcousticEvent = z.infer<typeof insertAcousticEventSchema>;
export type ModelDeployment = typeof modelDeployments.$inferSelect;
export type InsertModelDeployment = z.infer<typeof insertModelDeploymentSchema>;
export type LlmBudgetConfig = typeof llmBudgetConfigs.$inferSelect;
export type InsertLlmBudgetConfig = z.infer<typeof insertLlmBudgetConfigSchema>;
export type RetrainingTrigger = typeof retrainingTriggers.$inferSelect;
export type InsertRetrainingTrigger = z.infer<typeof insertRetrainingTriggerSchema>;
export type DigitalTwin = typeof digitalTwins.$inferSelect;
export type InsertDigitalTwin = z.infer<typeof insertDigitalTwinSchema>;
export type ModelRegistry = typeof modelRegistry.$inferSelect;
export type InsertModelRegistry = z.infer<typeof insertModelRegistrySchema>;
export type MlModelAccuracyHistory = typeof mlModelAccuracyHistory.$inferSelect;
export type InsertMlModelAccuracyHistory = z.infer<typeof insertMlModelAccuracyHistorySchema>;
export type PredictionDataQuality = typeof predictionDataQuality.$inferSelect;
export type InsertPredictionDataQuality = z.infer<typeof insertPredictionDataQualitySchema>;
export type InferenceRun = typeof inferenceRuns.$inferSelect;
export type InsertInferenceRun = z.infer<typeof insertInferenceRunSchema>;
export type PredictionExplanation = typeof predictionExplanations.$inferSelect;
export type InsertPredictionExplanation = z.infer<typeof insertPredictionExplanationSchema>;
export type ModelDriftMetric = typeof modelDriftMetrics.$inferSelect;
export type InsertModelDriftMetric = z.infer<typeof insertModelDriftMetricSchema>;

export const insertPredictionOutcomeSchema = createInsertSchema(predictionOutcomes).omit({
  id: true,
  createdAt: true,
});

export type PredictionOutcome = typeof predictionOutcomes.$inferSelect;
export type InsertPredictionOutcome = z.infer<typeof insertPredictionOutcomeSchema>;
