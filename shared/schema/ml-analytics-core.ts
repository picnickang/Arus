/**
 * Schema ML Analytics Core - ML Models, Predictions, and Degradation
 * 
 * Core ML tables including models, anomaly detection, failure predictions,
 * threshold optimization, component degradation, and failure history.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  numeric,
  timestamp,
  boolean,
  jsonb,
  serial,
  index,
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";
import { equipment } from "./equipment";
import { workOrders } from "./work-orders";

// LEGACY ML model management and versioning
export const mlModelsLegacy = pgTable(
  "ml_models_legacy",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    name: varchar("name").notNull(),
    version: varchar("version").notNull(),
    modelType: varchar("model_type").notNull(),
    targetEquipmentType: varchar("target_equipment_type"),
    trainingDataFeatures: jsonb("training_data_features"),
    hyperparameters: jsonb("hyperparameters"),
    performance: jsonb("performance"),
    modelArtifactPath: varchar("model_artifact_path"),
    status: varchar("status").default("training"),
    deployedAt: timestamp("deployed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    nameVersionIdx: index("idx_ml_models_legacy_name_version").on(table.name, table.version),
    orgIdx: index("idx_ml_models_legacy_org").on(table.orgId),
  })
);

// Active ML models
export const mlModels = pgTable(
  "ml_models",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("training"),
    accuracy: numeric("accuracy", { precision: 5, scale: 2 }),
    precision: numeric("precision", { precision: 5, scale: 2 }),
    recall: numeric("recall", { precision: 5, scale: 2 }),
    f1Score: numeric("f1_score", { precision: 5, scale: 2 }),
    trainedOn: timestamp("trained_on", { mode: "date" }),
    deployedOn: timestamp("deployed_on", { mode: "date" }),
    archivedOn: timestamp("archived_on", { mode: "date" }),
    dataPoints: integer("data_points"),
    equipmentType: varchar("equipment_type", { length: 100 }),
    dataWindowDays: integer("data_window_days"),
    trainingDurationMs: integer("training_duration_ms"),
    version: varchar("version", { length: 20 }).default("1.0"),
    hyperparameters: jsonb("hyperparameters"),
    featureImportance: jsonb("feature_importance"),
    trainingMetrics: jsonb("training_metrics"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("idx_ml_models_org_id").on(table.orgId),
    statusIdx: index("idx_ml_models_status").on(table.status),
    equipmentTypeIdx: index("idx_ml_models_equipment_type").on(table.equipmentType),
    trainedOnIdx: index("idx_ml_models_trained_on").on(table.trainedOn),
    orgStatusIdx: index("idx_ml_models_org_status").on(table.orgId, table.status),
    orgEquipTypeStatusIdx: index("idx_ml_models_org_equip_status").on(table.orgId, table.equipmentType, table.status),
  })
);

export const modelVersions = pgTable(
  "model_versions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    modelId: varchar("model_id").notNull().references(() => mlModels.id, { onDelete: "cascade" }),
    version: varchar("version", { length: 50 }).notNull(),
    artifactPath: varchar("artifact_path", { length: 500 }),
    status: varchar("status", { length: 50 }).notNull().default("staging"),
    accuracy: numeric("accuracy", { precision: 5, scale: 2 }),
    precision: numeric("precision", { precision: 5, scale: 2 }),
    recall: numeric("recall", { precision: 5, scale: 2 }),
    f1Score: numeric("f1_score", { precision: 5, scale: 2 }),
    trainingDataPoints: integer("training_data_points"),
    trainingDurationMs: integer("training_duration_ms"),
    hyperparameters: jsonb("hyperparameters"),
    featureNames: jsonb("feature_names"),
    changelog: text("changelog"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    promotedAt: timestamp("promoted_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => ({
    modelIdx: index("idx_model_versions_model").on(table.modelId),
    orgStatusIdx: index("idx_model_versions_org_status").on(table.orgId, table.status),
    modelVersionIdx: index("idx_model_versions_model_version").on(table.modelId, table.version),
  })
);

export const modelMetrics = pgTable(
  "model_metrics",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    modelVersionId: varchar("model_version_id").notNull().references(() => modelVersions.id, { onDelete: "cascade" }),
    metricName: varchar("metric_name", { length: 100 }).notNull(),
    metricValue: real("metric_value").notNull(),
    datasetName: varchar("dataset_name", { length: 100 }),
    sampleSize: integer("sample_size"),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    versionIdx: index("idx_model_metrics_version").on(table.modelVersionId),
    nameIdx: index("idx_model_metrics_name").on(table.metricName),
    versionNameIdx: index("idx_model_metrics_version_name").on(table.modelVersionId, table.metricName),
  })
);

// Anomaly detection results
export const anomalyDetections = pgTable(
  "anomaly_detections",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id").notNull(),
    equipmentId: varchar("equipment_id").notNull(),
    sensorType: varchar("sensor_type").notNull(),
    detectionTimestamp: timestamp("detection_timestamp", { withTimezone: true }).defaultNow(),
    anomalyScore: real("anomaly_score").notNull(),
    anomalyType: varchar("anomaly_type"),
    severity: varchar("severity").notNull(),
    detectedValue: real("detected_value"),
    expectedValue: real("expected_value"),
    deviation: real("deviation"),
    modelId: varchar("model_id").references(() => mlModelsLegacy.id),
    contributingFactors: jsonb("contributing_factors"),
    recommendedActions: jsonb("recommended_actions"),
    acknowledgedBy: varchar("acknowledged_by"),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedByWorkOrderId: varchar("resolved_by_work_order_id").references(() => workOrders.id),
    actualFailureOccurred: boolean("actual_failure_occurred"),
    outcomeLabel: varchar("outcome_label"),
    outcomeVerifiedAt: timestamp("outcome_verified_at", { withTimezone: true }),
    outcomeVerifiedBy: varchar("outcome_verified_by"),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    equipmentTimeIdx: index("idx_anomaly_equipment_time").on(table.equipmentId, table.detectionTimestamp),
    severityIdx: index("idx_anomaly_severity").on(table.severity),
  })
);

// Failure prediction results
export const failurePredictions = pgTable(
  "failure_predictions",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id").notNull(),
    equipmentId: varchar("equipment_id").notNull(),
    predictionTimestamp: timestamp("prediction_timestamp", { withTimezone: true }).defaultNow(),
    failureProbability: real("failure_probability").notNull(),
    predictedFailureDate: timestamp("predicted_failure_date", { withTimezone: true }),
    remainingUsefulLife: integer("remaining_useful_life"),
    confidenceInterval: jsonb("confidence_interval"),
    failureMode: varchar("failure_mode"),
    riskLevel: varchar("risk_level").notNull(),
    modelId: varchar("model_id").references(() => mlModelsLegacy.id),
    inputFeatures: jsonb("input_features"),
    maintenanceRecommendations: jsonb("maintenance_recommendations"),
    costImpact: jsonb("cost_impact"),
    resolvedByWorkOrderId: varchar("resolved_by_work_order_id").references(() => workOrders.id),
    actualFailureDate: timestamp("actual_failure_date", { withTimezone: true }),
    actualFailureMode: varchar("actual_failure_mode"),
    predictionAccuracy: real("prediction_accuracy"),
    timeToFailureError: integer("time_to_failure_error"),
    outcomeLabel: varchar("outcome_label"),
    outcomeVerifiedAt: timestamp("outcome_verified_at", { withTimezone: true }),
    outcomeVerifiedBy: varchar("outcome_verified_by"),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    equipmentRiskIdx: index("idx_failure_equipment_risk").on(table.equipmentId, table.riskLevel),
    predictionTimeIdx: index("idx_failure_prediction_time").on(table.predictionTimestamp),
  })
);

// Automated threshold optimization
export const thresholdOptimizations = pgTable(
  "threshold_optimizations",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    equipmentId: varchar("equipment_id").notNull(),
    sensorType: varchar("sensor_type").notNull(),
    optimizationTimestamp: timestamp("optimization_timestamp", { withTimezone: true }).defaultNow(),
    currentThresholds: jsonb("current_thresholds"),
    optimizedThresholds: jsonb("optimized_thresholds"),
    improvementMetrics: jsonb("improvement_metrics"),
    optimizationMethod: varchar("optimization_method"),
    validationResults: jsonb("validation_results"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    status: varchar("status").default("pending"),
    performance: jsonb("performance"),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    equipmentTimeIdx: index("idx_threshold_opt_equipment_time").on(table.equipmentId, table.optimizationTimestamp),
    orgIdx: index("idx_threshold_opt_org").on(table.orgId),
  })
);

// Component degradation tracking for RUL prediction
export const componentDegradation = pgTable(
  "component_degradation",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    equipmentId: varchar("equipment_id").notNull().references(() => equipment.id),
    componentType: varchar("component_type").notNull(),
    measurementTimestamp: timestamp("measurement_timestamp", { withTimezone: true }).defaultNow(),
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
    environmentConditions: jsonb("environment_conditions"),
    trendAnalysis: jsonb("trend_analysis"),
    predictedFailureDate: timestamp("predicted_failure_date", { withTimezone: true }),
    confidenceScore: real("confidence_score"),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    equipmentTimeIdx: index("idx_component_deg_equipment_time").on(table.equipmentId, table.measurementTimestamp),
    componentIdx: index("idx_component_deg_component").on(table.componentType),
  })
);

// Historical failure patterns for ML training
export const failureHistory = pgTable(
  "failure_history",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    equipmentId: varchar("equipment_id").notNull().references(() => equipment.id),
    failureTimestamp: timestamp("failure_timestamp", { withTimezone: true }).notNull(),
    failureMode: varchar("failure_mode").notNull(),
    failureSeverity: varchar("failure_severity").notNull(),
    rootCause: text("root_cause"),
    componentAffected: varchar("component_affected"),
    ageAtFailure: integer("age_at_failure"),
    cyclesAtFailure: integer("cycles_at_failure"),
    priorWarnings: jsonb("prior_warnings"),
    degradationHistory: jsonb("degradation_history"),
    environmentalFactors: jsonb("environmental_factors"),
    maintenanceHistory: jsonb("maintenance_history"),
    repairCost: real("repair_cost"),
    downtimeHours: real("downtime_hours"),
    replacementPartsCost: real("replacement_parts_cost"),
    totalCost: real("total_cost"),
    wasPreventable: boolean("was_preventable"),
    preventabilityAnalysis: text("preventability_analysis"),
    lessonsLearned: text("lessons_learned"),
    workOrderId: varchar("work_order_id").references(() => workOrders.id),
    verifiedBy: varchar("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    status: varchar("status").default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    repairType: varchar("repair_type"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    equipmentFailureIdx: index("idx_failure_history_equipment").on(table.equipmentId, table.failureTimestamp),
    failureModeIdx: index("idx_failure_history_mode").on(table.failureMode),
    severityIdx: index("idx_failure_history_severity").on(table.failureSeverity),
    repairLookupIdx: index("idx_failure_history_repairs").on(table.equipmentId, table.status, table.resolvedAt),
  })
);

// Insert schemas
export const insertMlModelLegacySchema = createInsertSchema(mlModelsLegacy).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMlModelSchema = createInsertSchema(mlModels).omit({ id: true, createdAt: true, updatedAt: true });
export const updateMlModelSchema = insertMlModelSchema.partial();
export const insertModelVersionSchema = createInsertSchema(modelVersions).omit({ id: true, createdAt: true });
export const insertModelMetricSchema = createInsertSchema(modelMetrics).omit({ id: true, computedAt: true });
export const insertAnomalyDetectionSchema = createInsertSchema(anomalyDetections).omit({ id: true, detectionTimestamp: true });
export const insertFailurePredictionSchema = createInsertSchema(failurePredictions).omit({ id: true, predictionTimestamp: true });
export const insertThresholdOptimizationSchema = createInsertSchema(thresholdOptimizations).omit({ id: true, optimizationTimestamp: true });
export const insertComponentDegradationSchema = createInsertSchema(componentDegradation).omit({ id: true, measurementTimestamp: true });
export const insertFailureHistorySchema = createInsertSchema(failureHistory).omit({ id: true, createdAt: true });

// Types
export type MlModelLegacy = typeof mlModelsLegacy.$inferSelect;
export type InsertMlModelLegacy = z.infer<typeof insertMlModelLegacySchema>;
export type MlModel = typeof mlModels.$inferSelect;
export type InsertMlModel = z.infer<typeof insertMlModelSchema>;
export type UpdateMlModel = z.infer<typeof updateMlModelSchema>;
export type ModelVersion = typeof modelVersions.$inferSelect;
export type InsertModelVersion = z.infer<typeof insertModelVersionSchema>;
export type ModelMetric = typeof modelMetrics.$inferSelect;
export type InsertModelMetric = z.infer<typeof insertModelMetricSchema>;
export type AnomalyDetection = typeof anomalyDetections.$inferSelect;
export type InsertAnomalyDetection = z.infer<typeof insertAnomalyDetectionSchema>;
export type FailurePrediction = typeof failurePredictions.$inferSelect;
export type InsertFailurePrediction = z.infer<typeof insertFailurePredictionSchema>;
export type ThresholdOptimization = typeof thresholdOptimizations.$inferSelect;
export type InsertThresholdOptimization = z.infer<typeof insertThresholdOptimizationSchema>;
export type ComponentDegradation = typeof componentDegradation.$inferSelect;
export type InsertComponentDegradation = z.infer<typeof insertComponentDegradationSchema>;
export type FailureHistory = typeof failureHistory.$inferSelect;
export type InsertFailureHistory = z.infer<typeof insertFailureHistorySchema>;
