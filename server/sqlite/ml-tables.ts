/**
 * SQLite ML Analytics Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getMlTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS ml_models (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT, model_type TEXT NOT NULL, model_name TEXT NOT NULL, version TEXT DEFAULT '1.0', status TEXT DEFAULT 'training', accuracy REAL, precision_score REAL, recall REAL, f1_score REAL, training_samples INTEGER, feature_importance TEXT, hyperparameters TEXT, model_path TEXT, trained_at INTEGER, deployed_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS failure_predictions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, equipment_type TEXT, model_id TEXT, model_type TEXT, prediction_type TEXT NOT NULL, failure_probability REAL NOT NULL, confidence REAL, estimated_days_to_failure REAL, confidence_interval_lower REAL, confidence_interval_upper REAL, contributing_factors TEXT, recommended_actions TEXT, prediction_date INTEGER NOT NULL, expires_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS anomaly_detections (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, anomaly_type TEXT NOT NULL, severity TEXT NOT NULL, detected_value REAL, expected_range_lower REAL, expected_range_upper REAL, z_score REAL, isolation_score REAL, detected_at INTEGER NOT NULL, resolved INTEGER DEFAULT 0, resolved_at INTEGER, notes TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS prediction_feedback (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, prediction_id TEXT NOT NULL, feedback_type TEXT NOT NULL, actual_outcome TEXT, feedback_notes TEXT, feedback_by TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS component_degradation (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, component_name TEXT NOT NULL, degradation_percent REAL NOT NULL, rate_of_change REAL, estimated_remaining_life_hours REAL, health_index REAL, contributing_factors TEXT, measurement_date INTEGER NOT NULL, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS failure_history (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, failure_type TEXT NOT NULL, failure_mode TEXT, root_cause TEXT, severity TEXT NOT NULL, impact_description TEXT, downtime_hours REAL, repair_cost REAL, parts_replaced TEXT, lessons_learned TEXT, preventive_measures TEXT, failure_date INTEGER NOT NULL, resolved_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS model_performance_validations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, model_id TEXT NOT NULL, validation_type TEXT NOT NULL, validation_date INTEGER NOT NULL, dataset_size INTEGER, accuracy REAL, precision_score REAL, recall REAL, f1_score REAL, mse REAL, mae REAL, notes TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS retraining_triggers (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, model_id TEXT NOT NULL, trigger_type TEXT NOT NULL, trigger_reason TEXT, performance_degradation_percent REAL, data_drift_score REAL, triggered_at INTEGER NOT NULL, status TEXT DEFAULT 'pending', completed_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS model_registry (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, model_type TEXT NOT NULL, framework TEXT, version TEXT, description TEXT, input_schema TEXT, output_schema TEXT, serving_endpoint TEXT, is_active INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS pdm_score_logs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, ts INTEGER, health_idx REAL, p_fail_30d REAL, predicted_due_date INTEGER, context_json TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS pdm_baseline (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, baseline_mean REAL, baseline_std REAL, upper_threshold REAL, lower_threshold REAL, sample_count INTEGER, computed_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS rul_models (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, model_type TEXT NOT NULL, weibull_beta REAL, weibull_eta REAL, current_rul_hours REAL, confidence_interval TEXT, last_updated INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS rul_fit_history (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, rul_model_id TEXT NOT NULL, fit_date INTEGER NOT NULL, training_samples INTEGER, beta REAL, eta REAL, goodness_of_fit REAL, notes TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS weibull_estimates (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, component TEXT, beta REAL NOT NULL, eta REAL NOT NULL, sample_size INTEGER, estimated_at INTEGER, created_at INTEGER)`,
  ];
}

export function getMlIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_ml_models_org ON ml_models(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_ml_models_equipment ON ml_models(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_failure_predictions_equipment ON failure_predictions(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_anomaly_detections_equipment ON anomaly_detections(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_component_degradation_equipment ON component_degradation(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_failure_history_equipment ON failure_history(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_pdm_score_logs_equipment ON pdm_score_logs(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_pdm_baseline_equipment ON pdm_baseline(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rul_models_equipment ON rul_models(equipment_id)`,
  ];
}
