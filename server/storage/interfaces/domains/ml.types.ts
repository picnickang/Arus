/**
 * ML Storage Interface - Models, Predictions, Feature Importance, RUL, Calibration
 * Part of IStorage modularization for improved maintainability
 */

import type {
  MlModel,
  InsertMlModel,
  MlModelAccuracyHistory,
  InsertMlModelAccuracyHistory,
  FeatureImportance,
  InsertFeatureImportance,
  CalibrationCurve,
  InsertCalibrationCurve,
  RulModel,
  InsertRulModel,
  PdmScoreLog,
  InsertPdmScoreLog as InsertPdmScore,
} from "@shared/schema";

/**
 * ML storage operations for models, predictions, and analytics
 */
export interface IMlStorage {
  // PDM Scores
  getPdmScores(equipmentId: string | undefined, orgId: string): Promise<PdmScoreLog[]>;
  createPdmScore(score: InsertPdmScore): Promise<PdmScoreLog>;
  getLatestPdmScore(equipmentId: string): Promise<PdmScoreLog | undefined>;

  // ML Models
  getMlModels(orgId: string, modelType?: string, status?: string): Promise<MlModel[]>;
  getMlModel(id: string, orgId: string): Promise<MlModel | undefined>;
  createMlModel(model: InsertMlModel, orgId: string): Promise<MlModel>;
  updateMlModel(id: string, updates: Partial<InsertMlModel>, orgId: string): Promise<MlModel>;
  deleteMlModel(id: string, orgId: string): Promise<void>;

  // ML Model Accuracy History
  getMlModelAccuracyHistory(modelId: string, orgId: string): Promise<MlModelAccuracyHistory[]>;
  addMlModelAccuracyHistory(
    history: InsertMlModelAccuracyHistory,
    orgId: string
  ): Promise<MlModelAccuracyHistory>;

  // Feature Importance
  createFeatureImportance(importance: InsertFeatureImportance): Promise<FeatureImportance>;
  getFeatureImportancesByPrediction(
    orgId: string,
    predictionId: number,
    predictionType: "real_time" | "batch" | "anomaly"
  ): Promise<FeatureImportance[]>;
  getFeatureImportancesByEquipment(
    orgId: string,
    equipmentId: string,
    limit?: number
  ): Promise<FeatureImportance[]>;
  getFeatureImportanceById(id: number, orgId: string): Promise<FeatureImportance | undefined>;

  // Calibration Curves
  getCalibrationCurves(
    orgId: string,
    modelType?: string,
    equipmentType?: string,
    status?: string
  ): Promise<CalibrationCurve[]>;
  getCalibrationCurve(id: string, orgId: string): Promise<CalibrationCurve | undefined>;
  getBestCalibrationCurve(
    orgId: string,
    modelType: string,
    equipmentType: string
  ): Promise<CalibrationCurve | undefined>;
  createCalibrationCurve(curve: InsertCalibrationCurve, orgId: string): Promise<CalibrationCurve>;
  updateCalibrationCurve(
    id: string,
    updates: Partial<InsertCalibrationCurve>,
    orgId: string
  ): Promise<CalibrationCurve>;
  deprecateCalibrationCurve(id: string, orgId: string): Promise<CalibrationCurve>;

  // RUL Models
  getRulModels(componentClass?: string, orgId?: string): Promise<RulModel[]>;
  getRulModel(modelId: string, orgId?: string): Promise<RulModel | undefined>;
  createRulModel(model: InsertRulModel): Promise<RulModel>;
  updateRulModel(id: string, model: Partial<InsertRulModel>): Promise<RulModel>;
  deleteRulModel(id: string): Promise<void>;

  // Prediction Accuracy
  linkPredictionToWorkOrder(
    predictionId: string,
    predictionType: "anomaly" | "failure",
    workOrderId: string,
    orgId?: string
  ): Promise<void>;
  labelPredictionOutcome(
    predictionId: string,
    predictionType: "anomaly" | "failure",
    outcome: {
      resolvedByWorkOrderId?: string;
      actualFailureOccurred: boolean;
      outcomeLabel: "true_positive" | "false_positive" | "true_negative" | "false_negative";
      predictionAccuracy?: number;
    },
    orgId?: string
  ): Promise<void>;
  getPredictionAccuracy(
    predictionType: "anomaly" | "failure",
    equipmentId: string | undefined,
    horizonDays: number,
    orgId?: string
  ): Promise<{
    totalPredictions: number;
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  }>;
}
