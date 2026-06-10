/**
 * ML Training Pipeline — consolidated implementation.
 *
 * Replaces the previous ./ml-training-pipeline/* modular split. Public
 * surface mirrors the original; runtime trainers are minimal stubs that
 * return inert results so consumers can compile and degrade gracefully
 * when training is not configured.
 */

import type { ModelEvaluationInputs } from "./services/ml/model-evaluation-gate";

export interface TrainingJobConfig {
  jobId: string;
  orgId: string;
  equipmentType: string;
  modelType: "lstm" | "random_forest" | "xgboost";
  [k: string]: unknown;
}

export interface LSTMTrainingConfig extends TrainingJobConfig {
  modelType: "lstm";
  epochs?: number;
  batchSize?: number;
  sequenceLength?: number;
}

export interface RFTrainingConfig extends TrainingJobConfig {
  modelType: "random_forest";
  nEstimators?: number;
  maxDepth?: number;
}

export interface XGBoostTrainingConfig extends TrainingJobConfig {
  modelType: "xgboost";
  nRounds?: number;
  learningRate?: number;
}

export interface TrainingResult {
  modelPath: string | null;
  metrics: Record<string, number>;
  trainedAt: Date;
  /**
   * Optional held-out evaluation inputs. When a real training run produces a
   * labelled test set and a callable predictor, it attaches them here so the
   * job queue can run the ModelEvaluationGate. Absent today (the pipeline is a
   * stub), in which case the run is recorded as "not_evaluated".
   */
  evaluation?: ModelEvaluationInputs;
}

function emptyResult(): TrainingResult {
  return { modelPath: null, metrics: {}, trainedAt: new Date() };
}

export async function trainLSTMForFailurePrediction(
  _config: LSTMTrainingConfig
): Promise<TrainingResult> {
  return emptyResult();
}

export async function trainRFForHealthClassification(
  _config: RFTrainingConfig
): Promise<TrainingResult> {
  return emptyResult();
}

export async function trainXGBoostForHealthClassification(
  _config: XGBoostTrainingConfig
): Promise<TrainingResult> {
  return emptyResult();
}

export async function retrainAllModels(
  _orgId: string,
  _equipmentType?: string
): Promise<TrainingResult[]> {
  return [];
}

export async function getBestModel(
  _orgId: string,
  _equipmentType: string,
  _modelType: "lstm" | "random_forest" | "xgboost"
): Promise<string | null> {
  return null;
}
