/**
 * Advanced ML realtime inference, explainability, deployment, and retraining schema tables.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamps,
  createdAtOnly,
  timestamp,
  boolean,
  jsonb,
  serial,
  index,
  unique,
} from "../base";
import { organizations } from "../core";
import { vessels } from "../vessels";
import { equipment } from "../equipment";
import {
  mlModels,
  modelVersions,
  failurePredictions,
  anomalyDetections,
} from "../ml-analytics-core";

// ========================================
// Phase 2.5: Advanced ML Features
// ========================================

// Real-time predictions for streaming inference
export const realTimePredictions = pgTable(
  "real_time_predictions",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    modelId: varchar("model_id")
      .notNull()
      .references(() => mlModels.id, { onDelete: "cascade" }),
    predictionTimestamp: timestamp("prediction_timestamp", { withTimezone: true }).defaultNow(),
    modelType: varchar("model_type").notNull(),
    failureProbability: real("failure_probability").notNull(),
    confidence: real("confidence").notNull(),
    healthScore: real("health_score").notNull(),
    remainingUsefulLife: integer("remaining_useful_life"),
    predictedFailureDate: timestamp("predicted_failure_date", { withTimezone: true }),
    riskLevel: varchar("risk_level").notNull(),
    inferenceLatencyMs: integer("inference_latency_ms"),
    inputFeatures: jsonb("input_features"),
    recommendations: jsonb("recommendations"),
    contextualFactors: jsonb("contextual_factors"),
    isCached: boolean("is_cached").default(false),
    publishedToStream: boolean("published_to_stream").default(false),
    metadata: jsonb("metadata"),
    ...timestamps(),
  },
  (table) => ({
    equipmentTimeIdx: index("idx_rt_pred_equipment_time").on(
      table.equipmentId,
      table.predictionTimestamp
    ),
    modelTypeIdx: index("idx_rt_pred_model_type").on(table.modelType),
    riskIdx: index("idx_rt_pred_risk").on(table.riskLevel, table.predictionTimestamp),
  })
);

// Feature importances for explainable AI (SHAP values)
export const featureImportances = pgTable(
  "feature_importances",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    realTimePredictionId: integer("real_time_prediction_id").references(
      () => realTimePredictions.id,
      { onDelete: "cascade" }
    ),
    failurePredictionId: integer("failure_prediction_id").references(() => failurePredictions.id, {
      onDelete: "cascade",
    }),
    anomalyDetectionId: integer("anomaly_detection_id").references(() => anomalyDetections.id, {
      onDelete: "cascade",
    }),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    modelId: varchar("model_id")
      .notNull()
      .references(() => mlModels.id, { onDelete: "cascade" }),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow(),
    baseValue: real("base_value").notNull(),
    shapValues: jsonb("shap_values").notNull(),
    topFeatures: jsonb("top_features").notNull(),
    explanationMethod: varchar("explanation_method").notNull().default("shap"),
    attentionWeights: jsonb("attention_weights"),
    featureValues: jsonb("feature_values").notNull(),
    interactionEffects: jsonb("interaction_effects"),
    computationTimeMs: integer("computation_time_ms"),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    realTimePredictionIdx: index("idx_feat_imp_rt_prediction").on(table.realTimePredictionId),
    failurePredictionIdx: index("idx_feat_imp_failure_prediction").on(table.failurePredictionId),
    anomalyDetectionIdx: index("idx_feat_imp_anomaly_detection").on(table.anomalyDetectionId),
    equipmentIdx: index("idx_feat_imp_equipment").on(table.equipmentId),
    modelIdx: index("idx_feat_imp_model").on(table.modelId),
    timeIdx: index("idx_feat_imp_time").on(table.calculatedAt),
  })
);

// Sensor fusion snapshots - Kalman filter states
export const sensorFusionSnapshots = pgTable(
  "sensor_fusion_snapshots",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
    fusionMethod: varchar("fusion_method").notNull().default("kalman"),
    sensorIds: text("sensor_ids").array().notNull(),
    sensorTypes: text("sensor_types").array().notNull(),
    rawReadings: jsonb("raw_readings").notNull(),
    fusedValue: real("fused_value").notNull(),
    uncertainty: real("uncertainty").notNull(),
    kalmanState: jsonb("kalman_state"),
    innovationResidual: real("innovation_residual"),
    noiseEstimate: real("noise_estimate"),
    qualityScore: real("quality_score").notNull(),
    outliersSuppressed: integer("outliers_suppressed").default(0),
    convergenceStatus: varchar("convergence_status").default("converged"),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    equipmentTimeIdx: index("idx_fusion_equipment_time").on(table.equipmentId, table.timestamp),
    methodIdx: index("idx_fusion_method").on(table.fusionMethod),
    qualityIdx: index("idx_fusion_quality").on(table.qualityScore),
  })
);

// Acoustic events for vibration/sound analysis
export const acousticEvents = pgTable(
  "acoustic_events",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    detectionTimestamp: timestamp("detection_timestamp", { withTimezone: true }).defaultNow(),
    eventType: varchar("event_type").notNull(),
    detectionMethod: varchar("detection_method").notNull(),
    audioSource: varchar("audio_source"),
    frequencyHz: real("frequency_hz"),
    amplitudeDb: real("amplitude_db"),
    spectralFeatures: jsonb("spectral_features"),
    wavelets: jsonb("wavelets"),
    signatureMatch: real("signature_match"),
    matchedSignatureId: varchar("matched_signature_id"),
    severity: varchar("severity").notNull(),
    confidence: real("confidence").notNull(),
    audioSnippetPath: varchar("audio_snippet_path"),
    spectrogramPath: varchar("spectrogram_path"),
    recommendations: jsonb("recommendations"),
    falsePositiveLikelihood: real("false_positive_likelihood"),
    verifiedBy: varchar("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    actualOutcome: varchar("actual_outcome"),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    equipmentTimeIdx: index("idx_acoustic_equipment_time").on(
      table.equipmentId,
      table.detectionTimestamp
    ),
    eventTypeIdx: index("idx_acoustic_event_type").on(table.eventType),
    severityIdx: index("idx_acoustic_severity").on(table.severity),
    signatureIdx: index("idx_acoustic_signature").on(table.matchedSignatureId),
  })
);

// Model deployment metadata for versioning and A/B testing
export const modelDeployments = pgTable(
  "model_deployments",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    modelId: varchar("model_id")
      .notNull()
      .references(() => mlModels.id, { onDelete: "cascade" }),
    modelVersionId: varchar("model_version_id").references(() => modelVersions.id),
    deploymentTarget: varchar("deployment_target").notNull(),
    deploymentStatus: varchar("deployment_status").notNull().default("pending"),
    trafficPercentage: integer("traffic_percentage").default(100),
    deployedAt: timestamp("deployed_at", { withTimezone: true }).defaultNow(),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
    modelFormat: varchar("model_format"),
    modelSize: integer("model_size"),
    quantization: varchar("quantization"),
    hardwareTarget: varchar("hardware_target"),
    maxLatencyMs: integer("max_latency_ms"),
    avgLatencyMs: integer("avg_latency_ms"),
    throughputQps: real("throughput_qps"),
    errorRate: real("error_rate"),
    deploymentConfig: jsonb("deployment_config"),
    rollbackModelId: varchar("rollback_model_id").references(() => mlModels.id),
    autoRollbackThreshold: real("auto_rollback_threshold"),
    deployedBy: varchar("deployed_by"),
    notes: text("notes"),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    modelStatusIdx: index("idx_deploy_model_status").on(table.modelId, table.deploymentStatus),
    targetIdx: index("idx_deploy_target").on(table.deploymentTarget),
    activeIdx: index("idx_deploy_active").on(table.deploymentStatus, table.trafficPercentage),
  })
);

// LLM budget configuration - organization-level spending controls
export const llmBudgetConfigs = pgTable(
  "llm_budget_configs",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .unique(),
    provider: varchar("provider"),
    dailyLimit: real("daily_limit"),
    monthlyLimit: real("monthly_limit"),
    alertThreshold: real("alert_threshold").default(0.8),
    currentDailySpend: real("current_daily_spend").default(0),
    currentMonthlySpend: real("current_monthly_spend").default(0),
    lastResetDate: timestamp("last_reset_date", { withTimezone: true }).defaultNow(),
    isEnabled: boolean("is_enabled").default(true),
    notifyEmail: text("notify_email"),
    blockWhenExceeded: boolean("block_when_exceeded").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    orgProviderIdx: index("idx_llm_budget_org_provider").on(table.orgId, table.provider),
  })
);

// Retraining triggers - automated signals for when models need retraining
export const retrainingTriggers = pgTable(
  "retraining_triggers",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    modelId: varchar("model_id")
      .notNull()
      .references(() => mlModels.id, { onDelete: "cascade" }),
    equipmentType: varchar("equipment_type"),
    triggerType: varchar("trigger_type").notNull(),
    triggerReason: text("trigger_reason").notNull(),
    triggerMetrics: jsonb("trigger_metrics").notNull(),
    currentPerformance: jsonb("current_performance"),
    performanceThreshold: real("performance_threshold"),
    newDataPoints: integer("new_data_points"),
    negativeFeedbackCount: integer("negative_feedback_count"),
    lastTrainingDate: timestamp("last_training_date", { withTimezone: true }),
    daysSinceTraining: integer("days_since_training"),
    priority: varchar("priority").notNull().default("medium"),
    status: varchar("status").notNull().default("pending"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    processingCompletedAt: timestamp("processing_completed_at", { withTimezone: true }),
    newModelId: varchar("new_model_id").references(() => mlModels.id),
    retrainingDuration: integer("retraining_duration"),
    retrainingResult: jsonb("retraining_result"),
    errorMessage: text("error_message"),
    triggeredBy: varchar("triggered_by"),
    reviewedBy: varchar("reviewed_by"),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    modelIdIdx: index("idx_retrain_model").on(table.modelId),
    statusIdx: index("idx_retrain_status").on(table.status),
    priorityIdx: index("idx_retrain_priority").on(table.priority),
    scheduledIdx: index("idx_retrain_scheduled").on(table.scheduledFor),
    triggerTypeIdx: index("idx_retrain_trigger_type").on(table.triggerType),
  })
);
