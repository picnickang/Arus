/**
 * Schema ML Analytics - Machine Learning and Predictive Analytics
 * 
 * Re-exports all ML analytics tables from the modular files.
 * This module was split for maintainability (300-line limit per file).
 * 
 * Core Tables (ml-analytics-core.ts):
 * - mlModelsLegacy, mlModels, anomalyDetections, failurePredictions
 * - thresholdOptimizations, componentDegradation, failureHistory
 * 
 * Advanced Tables (ml-analytics-advanced.ts):
 * - modelPerformanceValidations, predictionFeedback, vibrationFeatures
 * - rulModels, rulFitHistory, vibrationAnalysis, weibullEstimates
 * - pdmBaseline, pdmAlerts, realTimePredictions, featureImportances
 * - sensorFusionSnapshots, acousticEvents, modelDeployments
 * - llmBudgetConfigs, retrainingTriggers, digitalTwins, twinSimulations
 * - visualizationAssets, arMaintenanceProcedures
 */

export * from "./ml-analytics-core.js";
export * from "./ml-analytics-advanced.js";
