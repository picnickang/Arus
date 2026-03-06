/**
 * Schema ML Analytics Advanced - Validation, Feedback, Vibration, and RUL
 * 
 * Advanced ML tables including model performance validation, prediction feedback,
 * vibration analysis, RUL models, Weibull estimates, and PdM baselines.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  serial,
  index,
  unique,
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";
import { vessels } from "./vessels";
import { equipment } from "./equipment";
import { mlModels, modelVersions, failurePredictions, anomalyDetections } from "./ml-analytics-core";

// Model performance validation - tracks predictions vs actual outcomes
export const modelPerformanceValidations = pgTable(
  "model_performance_validations",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    modelId: varchar("model_id").notNull().references(() => mlModels.id, { onDelete: "cascade" }),
    equipmentId: varchar("equipment_id").notNull().references(() => equipment.id, { onDelete: "cascade" }),
    predictionId: integer("prediction_id"),
    predictionType: varchar("prediction_type").notNull(),
    predictionTimestamp: timestamp("prediction_timestamp", { withTimezone: true }).notNull(),
    predictedOutcome: jsonb("predicted_outcome").notNull(),
    actualOutcome: jsonb("actual_outcome"),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    validatedBy: varchar("validated_by"),
    accuracyScore: real("accuracy_score"),
    timeToFailureError: integer("time_to_failure_error"),
    classificationLabel: varchar("classification_label"),
    modelVersion: varchar("model_version"),
    performanceMetrics: jsonb("performance_metrics"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    modelIdIdx: index("idx_perf_val_model").on(table.modelId),
    equipmentIdIdx: index("idx_perf_val_equipment").on(table.equipmentId),
    predictionTimeIdx: index("idx_perf_val_prediction_time").on(table.predictionTimestamp),
    classificationIdx: index("idx_perf_val_classification").on(table.classificationLabel),
    modelEquipmentIdx: index("idx_perf_val_model_equipment").on(table.modelId, table.equipmentId),
    predictionLookupIdx: index("idx_perf_val_prediction_lookup").on(table.predictionType, table.predictionId),
  })
);

// Prediction feedback - user corrections and quality ratings
export const predictionFeedback = pgTable(
  "prediction_feedback",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    predictionId: integer("prediction_id").notNull(),
    predictionType: varchar("prediction_type").notNull(),
    equipmentId: varchar("equipment_id").notNull().references(() => equipment.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull(),
    feedbackType: varchar("feedback_type").notNull(),
    rating: integer("rating"),
    isAccurate: boolean("is_accurate"),
    correctedValue: jsonb("corrected_value"),
    comments: text("comments"),
    actualFailureDate: timestamp("actual_failure_date", { withTimezone: true }),
    actualFailureMode: varchar("actual_failure_mode"),
    flagReason: varchar("flag_reason"),
    useForRetraining: boolean("use_for_retraining").default(true),
    feedbackStatus: varchar("feedback_status").default("pending"),
    reviewedBy: varchar("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    predictionIdx: index("idx_feedback_prediction").on(table.predictionId, table.predictionType),
    equipmentIdx: index("idx_feedback_equipment").on(table.equipmentId),
    userIdx: index("idx_feedback_user").on(table.userId),
    statusIdx: index("idx_feedback_status").on(table.feedbackStatus),
    retrainingIdx: index("idx_feedback_retraining").on(table.useForRetraining, table.feedbackStatus),
  })
);

// Vibration Analysis: FFT features and ISO band analysis
export const vibrationFeatures = pgTable("vibration_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  equipmentId: text("equipment_id").notNull(),
  vesselId: varchar("vessel_id").references(() => vessels.id),
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow(),
  rpm: real("rpm"),
  rms: real("rms"),
  crestFactor: real("crest_factor"),
  kurtosis: real("kurtosis"),
  peakFrequency: real("peak_frequency"),
  band1Power: real("band_1_power"),
  band2Power: real("band_2_power"),
  band3Power: real("band_3_power"),
  band4Power: real("band_4_power"),
  rawDataLength: integer("raw_data_length"),
  sampleRate: real("sample_rate"),
  analysisMetadata: jsonb("analysis_metadata"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// RUL Models: Weibull reliability models for component failure prediction
export const rulModels = pgTable("rul_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  modelId: text("model_id").notNull().unique(),
  componentClass: text("component_class").notNull(),
  equipmentType: text("equipment_type"),
  shapeK: real("shape_k").notNull(),
  scaleLambda: real("scale_lambda").notNull(),
  confidenceLo: real("confidence_lo"),
  confidenceHi: real("confidence_hi"),
  fittedAt: timestamp("fitted_at", { mode: "date" }).defaultNow(),
  trainingData: jsonb("training_data"),
  validationMetrics: jsonb("validation_metrics"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// RUL Fit History: Version history for model retraining
export const rulFitHistory = pgTable("rul_fit_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  modelId: text("model_id").notNull(),
  shapeK: real("shape_k").notNull(),
  scaleLambda: real("scale_lambda").notNull(),
  trainingSize: integer("training_size"),
  goodnessOfFit: real("goodness_of_fit"),
  fittedAt: timestamp("fitted_at", { mode: "date" }).defaultNow(),
});

// Vibration analysis table
export const vibrationAnalysis = pgTable("vibration_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  equipmentId: varchar("equipment_id").notNull().references(() => equipment.id),
  sampleRate: real("sample_rate").notNull(),
  shaftRpm: real("shaft_rpm"),
  windowType: text("window_type").notNull().default("hann"),
  rawData: jsonb("raw_data").notNull(),
  spectrumData: jsonb("spectrum_data").notNull(),
  isoBands: jsonb("iso_bands").notNull(),
  faultBands: jsonb("fault_bands"),
  overallRms: real("overall_rms"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Weibull estimates table
export const weibullEstimates = pgTable("weibull_estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  equipmentId: varchar("equipment_id").notNull().references(() => equipment.id),
  currentAgeDays: real("current_age_days").notNull(),
  sampleData: jsonb("sample_data").notNull(),
  shapeParameter: real("shape_parameter").notNull(),
  scaleParameter: real("scale_parameter").notNull(),
  fittingMethod: text("fitting_method").notNull(),
  rulMedianDays: real("rul_median_days").notNull(),
  recommendation: text("recommendation"),
  analysisConfig: jsonb("analysis_config"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// PdM Pack v1 - Statistical baseline monitoring
export const pdmBaseline = pgTable(
  "pdm_baseline",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    vesselName: text("vessel_name").notNull(),
    assetId: text("asset_id").notNull(),
    assetClass: text("asset_class").notNull(),
    feature: text("feature").notNull(),
    mu: real("mu").notNull(),
    sigma: real("sigma").notNull(),
    n: integer("n").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniqueVesselAssetFeature: unique().on(table.orgId, table.vesselName, table.assetId, table.feature),
  })
);

// PdM alerts table
export const pdmAlerts = pgTable(
  "pdm_alerts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    at: timestamp("at", { mode: "date" }).defaultNow(),
    vesselName: text("vessel_name").notNull(),
    assetId: text("asset_id").notNull(),
    assetClass: text("asset_class").notNull(),
    feature: text("feature").notNull(),
    value: real("value"),
    scoreZ: real("score_z"),
    severity: text("severity"),
    explain: jsonb("explain"),
  },
  (table) => ({
    vesselAtIndex: sql`CREATE INDEX IF NOT EXISTS idx_pdm_alerts_vat ON ${table} (${table.orgId}, ${table.vesselName}, ${table.at} DESC)`,
  })
);

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
    modelVersionId: varchar("model_version_id")
      .references(() => modelVersions.id),
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

// ========================================
// Phase 3: Digital Twin Schema
// ========================================

// Digital twin vessel models
export const digitalTwins = pgTable(
  "digital_twins",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id")
      .references(() => vessels.id)
      .notNull(),
    twinType: varchar("twin_type").notNull(),
    name: varchar("name").notNull(),
    specifications: jsonb("specifications"),
    cadModel: jsonb("cad_model"),
    physicsModel: jsonb("physics_model"),
    currentState: jsonb("current_state"),
    lastUpdate: timestamp("last_update", { withTimezone: true }).defaultNow(),
    simulationConfig: jsonb("simulation_config"),
    validationStatus: varchar("validation_status").default("active"),
    accuracy: real("accuracy"),
    fuelEfficiency: real("fuel_efficiency"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_digital_twins_org_id").on(table.orgId),
    orgVesselIdx: index("idx_digital_twins_org_vessel").on(table.orgId, table.vesselId),
  })
);

// Digital twin simulation scenarios
export const twinSimulations = pgTable("twin_simulations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  digitalTwinId: varchar("digital_twin_id")
    .references(() => digitalTwins.id)
    .notNull(),
  scenarioName: varchar("scenario_name").notNull(),
  scenarioType: varchar("scenario_type").notNull(),
  inputParameters: jsonb("input_parameters"),
  simulationResults: jsonb("simulation_results"),
  startTime: timestamp("start_time", { withTimezone: true }).defaultNow(),
  endTime: timestamp("end_time", { withTimezone: true }),
  status: varchar("status").default("running"),
  progressPercentage: real("progress_percentage").default(0),
  recommendedActions: jsonb("recommended_actions"),
  costBenefitAnalysis: jsonb("cost_benefit_analysis"),
  metadata: jsonb("metadata"),
});

// 3D visualization assets
export const visualizationAssets = pgTable("visualization_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  assetType: varchar("asset_type").notNull(),
  name: varchar("name").notNull(),
  filePath: varchar("file_path").notNull(),
  fileFormat: varchar("file_format"),
  fileSizeBytes: integer("file_size_bytes"),
  targetPlatform: varchar("target_platform"),
  lodLevel: integer("lod_level"),
  boundingBox: jsonb("bounding_box"),
  textureResolution: varchar("texture_resolution"),
  compressionType: varchar("compression_type"),
  optimizationLevel: varchar("optimization_level"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// AR maintenance procedures
export const arMaintenanceProcedures = pgTable("ar_maintenance_procedures", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id")
    .references(() => equipment.id)
    .notNull(),
  procedureName: varchar("procedure_name").notNull(),
  procedureType: varchar("procedure_type").notNull(),
  arAssets: jsonb("ar_assets"),
  steps: jsonb("steps"),
  safetyRequirements: jsonb("safety_requirements"),
  requiredTools: jsonb("required_tools"),
  estimatedDuration: integer("estimated_duration"),
  difficultyLevel: varchar("difficulty_level"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Model registry for ML model versioning and management
export const modelRegistry = pgTable(
  "model_registry",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    componentClass: text("component_class").notNull(),
    modelType: text("model_type").notNull(),
    version: text("version").notNull(),
    algorithm: text("algorithm"),
    windowDays: integer("window_days"),
    features: jsonb("features"),
    metrics: jsonb("metrics"),
    isActive: boolean("is_active").default(true),
    deployedAt: timestamp("deployed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    componentIdx: sql`CREATE INDEX IF NOT EXISTS idx_model_registry_component ON model_registry (component_class, model_type)`,
    activeIdx: sql`CREATE INDEX IF NOT EXISTS idx_model_registry_active ON model_registry (is_active, deployed_at)`,
  })
);

// ML model accuracy history for tracking model performance over time
export const mlModelAccuracyHistory = pgTable(
  "ml_model_accuracy_history",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    modelId: varchar("model_id")
      .notNull()
      .references(() => mlModels.id),
    evaluationDate: timestamp("evaluation_date", { mode: "date" }).notNull(),
    accuracy: real("accuracy"),
    precision: real("precision"),
    recall: real("recall"),
    f1Score: real("f1_score"),
    mse: real("mse"),
    mae: real("mae"),
    rmse: real("rmse"),
    auc: real("auc"),
    testSetSize: integer("test_set_size"),
    evaluationMethod: text("evaluation_method"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    modelIdx: index("idx_ml_model_accuracy_model").on(table.modelId),
    dateIdx: index("idx_ml_model_accuracy_date").on(table.evaluationDate),
  })
);

// Prediction data quality metrics
export const predictionDataQuality = pgTable(
  "prediction_data_quality",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id),
    evaluationDate: timestamp("evaluation_date", { mode: "date" }).notNull(),
    dataCompleteness: real("data_completeness"),
    dataFreshness: real("data_freshness"),
    dataConsistency: real("data_consistency"),
    sensorCoverage: real("sensor_coverage"),
    overallQuality: real("overall_quality").notNull(),
    qualityGrade: text("quality_grade"),
    issuesDetected: jsonb("issues_detected"),
    recommendations: jsonb("recommendations"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentIdx: index("idx_prediction_dq_equipment").on(table.equipmentId),
    dateIdx: index("idx_prediction_dq_date").on(table.evaluationDate),
  })
);

// Inference runs — tracks each prediction invocation
export const inferenceRuns = pgTable(
  "inference_runs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    equipmentId: varchar("equipment_id").notNull().references(() => equipment.id),
    modelVersionId: varchar("model_version_id").references(() => modelVersions.id),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    latencyMs: integer("latency_ms"),
    status: varchar("status", { length: 50 }).notNull().default("running"),
    inputSnapshotRef: varchar("input_snapshot_ref", { length: 500 }),
    predictionId: integer("prediction_id"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    orgEquipIdx: index("idx_inference_runs_org_equip").on(table.orgId, table.equipmentId),
    statusIdx: index("idx_inference_runs_status").on(table.status),
    startedIdx: index("idx_inference_runs_started").on(table.startedAt),
  })
);

// Prediction explanations — feature contributions for each prediction
export const predictionExplanations = pgTable(
  "prediction_explanations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    predictionId: integer("prediction_id").notNull(),
    inferenceRunId: varchar("inference_run_id").references(() => inferenceRuns.id, { onDelete: "cascade" }),
    featureName: varchar("feature_name", { length: 100 }).notNull(),
    importance: real("importance").notNull(),
    featureValue: real("feature_value"),
    baselineValue: real("baseline_value"),
    direction: varchar("direction", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    predictionIdx: index("idx_pred_expl_prediction").on(table.predictionId),
    inferenceRunIdx: index("idx_pred_expl_inference_run").on(table.inferenceRunId),
    importanceIdx: index("idx_pred_expl_importance").on(table.importance),
  })
);

// Model drift metrics — distribution shift detection
export const modelDriftMetrics = pgTable(
  "model_drift_metrics",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    modelVersionId: varchar("model_version_id").notNull().references(() => modelVersions.id, { onDelete: "cascade" }),
    featureName: varchar("feature_name", { length: 100 }).notNull(),
    trainingMean: real("training_mean").notNull(),
    trainingStd: real("training_std"),
    liveMean: real("live_mean").notNull(),
    liveStd: real("live_std"),
    driftScore: real("drift_score").notNull(),
    driftDetected: boolean("drift_detected").default(false),
    windowDays: integer("window_days").notNull().default(7),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    versionIdx: index("idx_drift_metrics_version").on(table.modelVersionId),
    orgVersionIdx: index("idx_drift_metrics_org_version").on(table.orgId, table.modelVersionId),
    computedIdx: index("idx_drift_metrics_computed").on(table.computedAt),
  })
);

// Insert schemas
export const insertInferenceRunSchema = createInsertSchema(inferenceRuns).omit({ id: true });
export const insertPredictionExplanationSchema = createInsertSchema(predictionExplanations).omit({ id: true, createdAt: true });
export const insertModelDriftMetricSchema = createInsertSchema(modelDriftMetrics).omit({ id: true, computedAt: true });
export const insertModelPerformanceValidationSchema = createInsertSchema(modelPerformanceValidations).omit({ id: true, createdAt: true });
export const insertPredictionFeedbackSchema = createInsertSchema(predictionFeedback).omit({ id: true, createdAt: true });
export const insertVibrationFeatureSchema = createInsertSchema(vibrationFeatures).omit({ id: true, createdAt: true });
export const insertRulModelSchema = createInsertSchema(rulModels).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRulFitHistorySchema = createInsertSchema(rulFitHistory).omit({ id: true });
export const insertVibrationAnalysisSchema = createInsertSchema(vibrationAnalysis).omit({ id: true, createdAt: true });
export const insertWeibullEstimateSchema = createInsertSchema(weibullEstimates).omit({ id: true, createdAt: true });
export const insertPdmBaselineSchema = createInsertSchema(pdmBaseline).omit({ id: true, updatedAt: true });
export const insertPdmAlertSchema = createInsertSchema(pdmAlerts).omit({ id: true, at: true });
export const insertRealTimePredictionSchema = createInsertSchema(realTimePredictions).omit({ id: true });
export const insertFeatureImportanceSchema = createInsertSchema(featureImportances).omit({ id: true });
export const insertSensorFusionSnapshotSchema = createInsertSchema(sensorFusionSnapshots).omit({ id: true });
export const insertAcousticEventSchema = createInsertSchema(acousticEvents).omit({ id: true });
export const insertModelDeploymentSchema = createInsertSchema(modelDeployments).omit({ id: true });
export const insertLlmBudgetConfigSchema = createInsertSchema(llmBudgetConfigs).omit({ id: true });
export const insertRetrainingTriggerSchema = createInsertSchema(retrainingTriggers).omit({ id: true });
export const insertDigitalTwinSchema = createInsertSchema(digitalTwins).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTwinSimulationSchema = createInsertSchema(twinSimulations).omit({ id: true });
export const insertVisualizationAssetSchema = createInsertSchema(visualizationAssets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertArMaintenanceProcedureSchema = createInsertSchema(arMaintenanceProcedures).omit({ id: true, createdAt: true, updatedAt: true });
export const insertModelRegistrySchema = createInsertSchema(modelRegistry).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMlModelAccuracyHistorySchema = createInsertSchema(mlModelAccuracyHistory).omit({ id: true, createdAt: true });
export const insertPredictionDataQualitySchema = createInsertSchema(predictionDataQuality).omit({ id: true, createdAt: true });

// Types
export type ModelPerformanceValidation = typeof modelPerformanceValidations.$inferSelect;
export type InsertModelPerformanceValidation = z.infer<typeof insertModelPerformanceValidationSchema>;
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
export type TwinSimulation = typeof twinSimulations.$inferSelect;
export type InsertTwinSimulation = z.infer<typeof insertTwinSimulationSchema>;
export type VisualizationAsset = typeof visualizationAssets.$inferSelect;
export type InsertVisualizationAsset = z.infer<typeof insertVisualizationAssetSchema>;
export type ArMaintenanceProcedure = typeof arMaintenanceProcedures.$inferSelect;
export type InsertArMaintenanceProcedure = z.infer<typeof insertArMaintenanceProcedureSchema>;
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
