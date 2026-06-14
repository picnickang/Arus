/**
 * Advanced ML validation, feedback, vibration, RUL, and PdM schema tables.
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
} from "../ml-analytics-core";

// Model performance validation - tracks predictions vs actual outcomes
export const modelPerformanceValidations = pgTable(
  "model_performance_validations",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    modelId: varchar("model_id")
      .notNull()
      .references(() => mlModels.id, { onDelete: "cascade" }),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
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
    predictionLookupIdx: index("idx_perf_val_prediction_lookup").on(
      table.predictionType,
      table.predictionId
    ),
  })
);

// Prediction feedback - user corrections and quality ratings
export const predictionFeedback = pgTable(
  "prediction_feedback",
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
    retrainingIdx: index("idx_feedback_retraining").on(
      table.useForRetraining,
      table.feedbackStatus
    ),
  })
);

// Vibration Analysis: FFT features and ISO band analysis
export const vibrationFeatures = pgTable("vibration_features", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
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
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
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
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  modelId: text("model_id").notNull(),
  shapeK: real("shape_k").notNull(),
  scaleLambda: real("scale_lambda").notNull(),
  trainingSize: integer("training_size"),
  goodnessOfFit: real("goodness_of_fit"),
  fittedAt: timestamp("fitted_at", { mode: "date" }).defaultNow(),
});

// Vibration analysis table
export const vibrationAnalysis = pgTable("vibration_analysis", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  equipmentId: varchar("equipment_id")
    .notNull()
    .references(() => equipment.id),
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
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  equipmentId: varchar("equipment_id")
    .notNull()
    .references(() => equipment.id),
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
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselName: text("vessel_name").notNull(),
    assetId: text("asset_id").notNull(),
    assetClass: text("asset_class").notNull(),
    feature: text("feature").notNull(),
    mu: real("mu").notNull(),
    sigma: real("sigma").notNull(),
    n: integer("n").notNull().default(0),
    ...createdAtOnly(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniqueVesselAssetFeature: unique().on(
      table.orgId,
      table.vesselName,
      table.assetId,
      table.feature
    ),
  })
);

// PdM alerts table
export const pdmAlerts = pgTable(
  "pdm_alerts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    at: timestamp("at", { mode: "date" }).defaultNow(),
    vesselName: text("vessel_name").notNull(),
    assetId: text("asset_id").notNull(),
    assetClass: text("asset_class").notNull(),
    feature: text("feature").notNull(),
    value: real("value"),
    scoreZ: real("score_z"),
    severity: text("severity"),
    explain: jsonb("explain"),
    ...timestamps(),
  },
  (table) => ({
    vesselAtIndex: sql`CREATE INDEX IF NOT EXISTS idx_pdm_alerts_vat ON ${table} (${table.orgId}, ${table.vesselName}, ${table.at} DESC)`,
  })
);
