/**
 * Analytics Types - Modular Entry Point
 *
 * Re-exports all analytics type definitions from domain-specific modules.
 *
 * @see ./reconciliation.ts - Data reconciliation types
 * @see ./metadata.ts - Standard metadata schemas
 * @see ./equipment.ts - Equipment analytics DTOs
 * @see ./ml-models.ts - ML model DTOs
 * @see ./anomaly.ts - Anomaly detection DTOs
 * @see ./prediction.ts - Failure and real-time prediction DTOs
 * @see ./explainability.ts - Explainability DTOs
 * @see ./export.ts - Data export DTOs
 * @see ./model-quality.ts - Model drift and quality DTOs
 * @see ./feedback.ts - Prediction feedback DTOs
 * @see ./llm-costs.ts - LLM cost tracking DTOs
 * @see ./generic.ts - Generic response wrappers
 */

export * from "./reconciliation";
export * from "./metadata";
export * from "./equipment";
export * from "./ml-models";
export * from "./anomaly";
export * from "./prediction";
export * from "./explainability";
export * from "./export";
export * from "./model-quality";
export * from "./feedback";
export * from "./llm-costs";
export * from "./generic";

import {
  equipmentHealthDtoSchema,
  equipmentHealthResponseSchema,
  rulPredictionDtoSchema,
  rulPredictionResponseSchema,
  rulBatchResponseSchema,
  sensorCoverageDtoSchema,
  sensorCoverageResponseSchema,
} from "./equipment";
import {
  mlModelDtoSchema,
  mlModelListResponseSchema,
  mlModelResponseSchema,
  modelPerformanceDtoSchema,
  modelPerformanceSummaryDtoSchema,
  modelPerformanceListResponseSchema,
  modelPerformanceSummaryResponseSchema,
} from "./ml-models";
import {
  anomalyDetectionDtoSchema,
  anomalyDetectionListResponseSchema,
  anomalyDetectionResponseSchema,
} from "./anomaly";
import {
  failurePredictionDtoSchema,
  failurePredictionListResponseSchema,
  failurePredictionResponseSchema,
  realtimePredictionDtoSchema,
  realtimePredictionListResponseSchema,
} from "./prediction";
import {
  predictionExplainabilityDtoSchema,
  predictionExplainabilityResponseSchema,
  featureImportanceDtoSchema,
  featureImportanceListResponseSchema,
} from "./explainability";
import { dataExportMetadataDtoSchema, dataExportResponseSchema } from "./export";
import {
  modelDriftDtoSchema,
  modelDriftListResponseSchema,
  retrainingQueueItemDtoSchema,
  retrainingQueueResponseSchema,
} from "./model-quality";
import {
  predictionFeedbackDtoSchema,
  predictionFeedbackListResponseSchema,
  predictionFeedbackSummaryDtoSchema,
  predictionFeedbackSummaryResponseSchema,
} from "./feedback";
import {
  llmCostDtoSchema,
  llmCostListResponseSchema,
  llmCostSummaryDtoSchema,
  llmCostSummaryResponseSchema,
} from "./llm-costs";
import { createListResponse, createItemResponse, errorResponseSchema } from "./generic";

export default {
  equipmentHealthDtoSchema,
  equipmentHealthResponseSchema,
  rulPredictionDtoSchema,
  rulPredictionResponseSchema,
  rulBatchResponseSchema,
  sensorCoverageDtoSchema,
  sensorCoverageResponseSchema,
  mlModelDtoSchema,
  mlModelListResponseSchema,
  mlModelResponseSchema,
  modelPerformanceDtoSchema,
  modelPerformanceSummaryDtoSchema,
  modelPerformanceListResponseSchema,
  modelPerformanceSummaryResponseSchema,
  anomalyDetectionDtoSchema,
  anomalyDetectionListResponseSchema,
  anomalyDetectionResponseSchema,
  failurePredictionDtoSchema,
  failurePredictionListResponseSchema,
  failurePredictionResponseSchema,
  realtimePredictionDtoSchema,
  realtimePredictionListResponseSchema,
  predictionExplainabilityDtoSchema,
  predictionExplainabilityResponseSchema,
  featureImportanceDtoSchema,
  featureImportanceListResponseSchema,
  dataExportMetadataDtoSchema,
  dataExportResponseSchema,
  modelDriftDtoSchema,
  modelDriftListResponseSchema,
  retrainingQueueItemDtoSchema,
  retrainingQueueResponseSchema,
  predictionFeedbackDtoSchema,
  predictionFeedbackListResponseSchema,
  predictionFeedbackSummaryDtoSchema,
  predictionFeedbackSummaryResponseSchema,
  llmCostDtoSchema,
  llmCostListResponseSchema,
  llmCostSummaryDtoSchema,
  llmCostSummaryResponseSchema,
  createListResponse,
  createItemResponse,
  errorResponseSchema,
};
