/**
 * Advanced ML registry, runtime, drift, and outcome schema tables.
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
} from "../base";
import { organizations } from "../core";
import { vessels } from "../vessels";
import { equipment } from "../equipment";
import { mlModels, modelVersions } from "../ml-analytics-core";

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
  (_table) => ({
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
    modelId: varchar("model_id")
      .notNull()
      .references(() => mlModels.id),
    accuracy: real("accuracy"),
  },
  (table) => ({
    modelIdx: index("idx_ml_model_accuracy_model").on(table.modelId),
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
    dataFreshness: text("data_freshness"),
    sensorCoverage: real("sensor_coverage"),
  },
  (table) => ({
    equipmentIdx: index("idx_prediction_dq_equipment").on(table.equipmentId),
  })
);

// Inference runs — tracks each prediction invocation
export const inferenceRuns = pgTable(
  "inference_runs",
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
    orgStartedIdx: index("idx_inference_runs_org_started").on(table.orgId, table.startedAt),
    statusIdx: index("idx_inference_runs_status").on(table.status),
    startedIdx: index("idx_inference_runs_started").on(table.startedAt),
  })
);

// Prediction explanations — feature contributions for each prediction
export const predictionExplanations = pgTable(
  "prediction_explanations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    predictionId: integer("prediction_id").notNull(),
    inferenceRunId: varchar("inference_run_id").references(() => inferenceRuns.id, {
      onDelete: "cascade",
    }),
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
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    modelVersionId: varchar("model_version_id")
      .notNull()
      .references(() => modelVersions.id, { onDelete: "cascade" }),
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

/**
 * Push A1 — Prediction outcomes (label pipeline).
 *
 * Materialised "ground truth" rows used as the training-label substrate for
 * weekly model retraining. Each row pairs a stored prediction with the
 * observed outcome derived from one of:
 *   - the work-order close-out wizard (`prediction_feedback` rows where
 *     `actualFailureMode` / `actualFailureDate` are non-null), or
 *   - the `failure_history` table (post-hoc backfill).
 *
 * `featureSnapshotId` is a hard FK-by-convention to `equipment_features.id`
 * captured at prediction time so trainers can re-load the exact feature
 * vector that produced the prediction (point-in-time correctness).
 *
 * Rows are append-only; the unique constraint on
 * (predictionId, predictionType, outcomeSource) makes the writer idempotent
 * against replay of the same closeout event.
 */
export const predictionOutcomes = pgTable(
  "prediction_outcomes",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    predictionId: integer("prediction_id").notNull(),
    predictionType: varchar("prediction_type").notNull(),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    modelId: varchar("model_id").references(() => mlModels.id, { onDelete: "set null" }),
    modelVersion: varchar("model_version"),
    featureSnapshotId: varchar("feature_snapshot_id"),
    predictedFailureProbability: real("predicted_failure_probability").notNull(),
    predictedRul: integer("predicted_rul"),
    predictedFailureDate: timestamp("predicted_failure_date", { withTimezone: true }),
    actualFailureMode: varchar("actual_failure_mode"),
    actualFailureDate: timestamp("actual_failure_date", { withTimezone: true }),
    actualOutcomeLabel: varchar("actual_outcome_label"),
    rulErrorDays: integer("rul_error_days"),
    absoluteError: real("absolute_error"),
    outcomeSource: varchar("outcome_source").notNull(),
    sourceRecordId: varchar("source_record_id"),
    useForRetraining: boolean("use_for_retraining").default(true).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgEquipIdx: index("idx_pred_outcomes_org_equip").on(table.orgId, table.equipmentId),
    modelIdx: index("idx_pred_outcomes_model").on(table.modelId),
    retrainIdx: index("idx_pred_outcomes_retrain").on(table.useForRetraining, table.observedAt),
    uniqPredictionOutcome: unique("uq_pred_outcomes_pred_source").on(
      table.predictionId,
      table.predictionType,
      table.outcomeSource
    ),
  })
);
