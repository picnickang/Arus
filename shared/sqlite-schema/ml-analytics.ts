/**
 * SQLite Schema ML Analytics Module
 * ML models, predictions, anomalies, vibration, RUL, degradation
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const mlModelsSqlite = sqliteTable(
  "ml_models",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    modelType: text("model_type").notNull(),
    version: text("version").notNull(),
    equipmentType: text("equipment_type"),
    status: text("status").notNull().default("active"),
    accuracy: real("accuracy"),
    precision: real("precision"),
    recall: real("recall"),
    f1Score: real("f1_score"),
    trainingDataCount: integer("training_data_count"),
    lastTrainedAt: integer("last_trained_at", { mode: "timestamp" }),
    modelPath: text("model_path"),
    hyperparameters: text("hyperparameters"),
    featureImportance: text("feature_importance"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_mm_org").on(table.orgId),
    typeIdx: index("idx_mm_type").on(table.modelType),
    statusIdx: index("idx_mm_status").on(table.status),
  })
);

export const pdmScoreLogsSqlite = sqliteTable(
  "pdm_score_logs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    ts: integer("ts", { mode: "timestamp" }),
    equipmentId: text("equipment_id").notNull(),
    healthIdx: real("health_idx"),
    pFail30d: real("p_fail_30d"),
    predictedDueDate: integer("predicted_due_date", { mode: "timestamp" }),
    contextJson: text("context_json", { mode: "json" }),
  },
  (table) => ({
    equipmentIdx: index("idx_psl_equipment").on(table.equipmentId),
  })
);

export const failurePredictionsSqlite = sqliteTable(
  "failure_predictions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    equipmentType: text("equipment_type"),
    predictionTimestamp: integer("prediction_timestamp", { mode: "timestamp" }),
    failureProbability: real("failure_probability").notNull(),
    predictedFailureDate: integer("predicted_failure_date", { mode: "timestamp" }),
    remainingUsefulLife: integer("remaining_useful_life"),
    confidence: real("confidence"),
    confidenceInterval: text("confidence_interval", { mode: "json" }),
    failureMode: text("failure_mode"),
    riskLevel: text("risk_level").notNull(),
    modelType: text("model_type"),
    modelId: text("model_id"),
    inputFeatures: text("input_features", { mode: "json" }),
    maintenanceRecommendations: text("maintenance_recommendations", { mode: "json" }),
    costImpact: text("cost_impact", { mode: "json" }),
    resolvedByWorkOrderId: text("resolved_by_work_order_id"),
    actualFailureDate: integer("actual_failure_date", { mode: "timestamp" }),
    actualFailureMode: text("actual_failure_mode"),
    predictionAccuracy: real("prediction_accuracy"),
    timeToFailureError: integer("time_to_failure_error"),
    outcomeLabel: text("outcome_label"),
    outcomeVerifiedAt: integer("outcome_verified_at", { mode: "timestamp" }),
    outcomeVerifiedBy: text("outcome_verified_by"),
    predictionValidUntil: integer("prediction_valid_until", { mode: "timestamp" }),
    modelVersionId: text("model_version_id"),
    featureSetVersion: text("feature_set_version"),
    featureSnapshotId: text("feature_snapshot_id"),
    reviewStatus: text("review_status").default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
    suppressionReason: text("suppression_reason"),
    governanceMetadata: text("governance_metadata", { mode: "json" }),
    metadata: text("metadata", { mode: "json" }),
  },
  (table) => ({
    equipmentRiskIdx: index("idx_fp_equipment_risk").on(table.equipmentId, table.riskLevel),
    predictionTimeIdx: index("idx_fp_prediction_time").on(table.predictionTimestamp),
    orgReviewIdx: index("idx_fp_org_review").on(table.orgId, table.reviewStatus),
  })
);

export const anomalyDetectionsSqlite = sqliteTable(
  "anomaly_detections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    detectionTimestamp: integer("detection_timestamp", { mode: "timestamp" }),
    anomalyScore: real("anomaly_score").notNull(),
    anomalyType: text("anomaly_type"),
    severity: text("severity").notNull(),
    detectedValue: real("detected_value"),
    expectedValue: real("expected_value"),
    deviation: real("deviation"),
    modelId: text("model_id"),
    contributingFactors: text("contributing_factors", { mode: "json" }),
    recommendedActions: text("recommended_actions", { mode: "json" }),
    acknowledgedBy: text("acknowledged_by"),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
    resolvedByWorkOrderId: text("resolved_by_work_order_id"),
    actualFailureOccurred: integer("actual_failure_occurred", { mode: "boolean" }),
    outcomeLabel: text("outcome_label"),
    outcomeVerifiedAt: integer("outcome_verified_at", { mode: "timestamp" }),
    outcomeVerifiedBy: text("outcome_verified_by"),
    metadata: text("metadata", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentTimeIdx: index("idx_ad_equipment_time").on(
      table.equipmentId,
      table.detectionTimestamp
    ),
    severityIdx: index("idx_ad_severity").on(table.severity),
    orgTimeIdx: index("idx_ad_org_time").on(table.orgId, table.detectionTimestamp),
  })
);

export const predictionFeedbackSqlite = sqliteTable(
  "prediction_feedback",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    predictionId: text("prediction_id").notNull(),
    feedbackType: text("feedback_type").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }),
    actualOutcome: text("actual_outcome"),
    actualFailureDate: integer("actual_failure_date", { mode: "timestamp" }),
    notes: text("notes"),
    providedBy: text("provided_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    predictionIdx: index("idx_pf_prediction").on(table.predictionId),
  })
);

export const componentDegradationSqlite = sqliteTable(
  "component_degradation",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    componentType: text("component_type").notNull(),
    measurementTimestamp: integer("measurement_timestamp", { mode: "timestamp" }),
    degradationMetric: real("degradation_metric").notNull(),
    degradationRate: real("degradation_rate"),
    vibrationLevel: real("vibration_level"),
    temperature: real("temperature"),
    oilCondition: real("oil_condition"),
    acousticSignature: real("acoustic_signature"),
    wearParticleCount: integer("wear_particle_count"),
    operatingHours: integer("operating_hours"),
    cycleCount: integer("cycle_count"),
    loadFactor: real("load_factor"),
    environmentConditions: text("environment_conditions", { mode: "json" }),
    trendAnalysis: text("trend_analysis", { mode: "json" }),
    predictedFailureDate: integer("predicted_failure_date", { mode: "timestamp" }),
    confidenceScore: real("confidence_score"),
    metadata: text("metadata", { mode: "json" }),
  },
  (table) => ({
    equipmentTimeIdx: index("idx_cd_equipment_time").on(
      table.equipmentId,
      table.measurementTimestamp
    ),
    componentIdx: index("idx_cd_component").on(table.componentType),
  })
);

export const failureHistorySqlite = sqliteTable(
  "failure_history",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    failureDate: integer("failure_date", { mode: "timestamp" }).notNull(),
    failureType: text("failure_type").notNull(),
    severity: text("severity").notNull(),
    rootCause: text("root_cause"),
    symptoms: text("symptoms"),
    downtimeHours: real("downtime_hours"),
    repairCost: real("repair_cost"),
    partsCost: real("parts_cost"),
    laborCost: real("labor_cost"),
    wasPredicted: integer("was_predicted", { mode: "boolean" }),
    predictionId: text("prediction_id"),
    workOrderId: text("work_order_id"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_fh_equipment").on(table.equipmentId),
    failureDateIdx: index("idx_fh_failure_date").on(table.failureDate),
  })
);

export const dtcDefinitionsSqlite = sqliteTable(
  "dtc_definitions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    severity: text("severity").notNull().default("warning"),
    category: text("category"),
    possibleCauses: text("possible_causes"),
    recommendedActions: text("recommended_actions"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    codeIdx: index("idx_dtcd_code").on(table.code),
  })
);

export const dtcFaultsSqlite = sqliteTable(
  "dtc_faults",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    dtcDefinitionId: text("dtc_definition_id").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    clearedAt: integer("cleared_at", { mode: "timestamp" }),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    occurrenceCount: integer("occurrence_count").default(1),
    severity: text("severity"),
    notes: text("notes"),
    workOrderId: text("work_order_id"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_dtcf_equipment").on(table.equipmentId),
    activeIdx: index("idx_dtcf_active").on(table.isActive),
  })
);

export const modelPerformanceValidationsSqlite = sqliteTable(
  "model_performance_validations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    modelId: text("model_id").notNull(),
    validationDate: integer("validation_date", { mode: "timestamp" }).notNull(),
    validationType: text("validation_type").notNull(),
    accuracy: real("accuracy"),
    precision: real("precision"),
    recall: real("recall"),
    f1Score: real("f1_score"),
    confusionMatrix: text("confusion_matrix"),
    sampleSize: integer("sample_size"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    modelIdx: index("idx_mpv_model").on(table.modelId),
    dateIdx: index("idx_mpv_date").on(table.validationDate),
  })
);

export const retrainingTriggersSqlite = sqliteTable(
  "retraining_triggers",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    modelId: text("model_id").notNull(),
    triggerType: text("trigger_type").notNull(),
    triggerReason: text("trigger_reason"),
    triggeredAt: integer("triggered_at", { mode: "timestamp" }).notNull(),
    status: text("status").notNull().default("pending"),
    processedAt: integer("processed_at", { mode: "timestamp" }),
    result: text("result"),
    newModelId: text("new_model_id"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    modelIdx: index("idx_rt_model").on(table.modelId),
    statusIdx: index("idx_rt_status").on(table.status),
  })
);

export const vibrationFeaturesSqlite = sqliteTable(
  "vibration_features",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    ts: integer("ts", { mode: "timestamp" }).notNull(),
    rmsVelocity: real("rms_velocity"),
    peakAcceleration: real("peak_acceleration"),
    crestFactor: real("crest_factor"),
    kurtosis: real("kurtosis"),
    dominantFrequency: real("dominant_frequency"),
    harmonics: text("harmonics"),
    bearingDefectFrequencies: text("bearing_defect_frequencies"),
    overallHealthScore: real("overall_health_score"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentTsIdx: index("idx_vf_equipment_ts").on(table.equipmentId, table.ts),
  })
);

export const modelRegistrySqlite = sqliteTable(
  "model_registry",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    stage: text("stage").notNull().default("development"),
    modelType: text("model_type").notNull(),
    framework: text("framework"),
    modelPath: text("model_path"),
    metrics: text("metrics"),
    inputSchema: text("input_schema"),
    outputSchema: text("output_schema"),
    description: text("description"),
    tags: text("tags"),
    createdBy: text("created_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    nameVersionIdx: index("idx_mr_name_version").on(table.name, table.version),
    stageIdx: index("idx_mr_stage").on(table.stage),
  })
);
