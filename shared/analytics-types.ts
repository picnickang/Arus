/**
 * Analytics API Type Definitions - Backward Compatibility Shim
 *
 * This file maintains backward compatibility with existing imports.
 * The actual types have been modularized into shared/analytics-types/
 *
 * @see ./analytics-types/index.ts - Main entry point
 * @see ./analytics-types/reconciliation.ts - Data reconciliation types
 * @see ./analytics-types/metadata.ts - Standard metadata schemas
 * @see ./analytics-types/equipment.ts - Equipment analytics DTOs
 * @see ./analytics-types/ml-models.ts - ML model DTOs
 * @see ./analytics-types/anomaly.ts - Anomaly detection DTOs
 * @see ./analytics-types/prediction.ts - Failure/real-time prediction DTOs
 * @see ./analytics-types/explainability.ts - Explainability DTOs
 * @see ./analytics-types/export.ts - Data export DTOs
 * @see ./analytics-types/model-quality.ts - Model drift/quality DTOs
 * @see ./analytics-types/feedback.ts - Prediction feedback DTOs
 * @see ./analytics-types/llm-costs.ts - LLM cost tracking DTOs
 * @see ./analytics-types/generic.ts - Generic response wrappers
 */

export * from "./analytics-types/index";
export { default } from "./analytics-types/index";
