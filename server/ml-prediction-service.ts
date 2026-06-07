/**
 * ML Prediction Service - thin re-export shim over `./ml-prediction/*`.
 * Kept for backward-compat with legacy import paths.
 */

import type { MLPredictionResult } from "./ml-prediction/types.js";

export {
  predictFailureWithLSTM,
  predictHealthWithRandomForest,
  predictWithHybridModel,
  predictWithEnsemble,
} from "./ml-prediction/predictors.js";

export { storePrediction } from "./ml-prediction/storage.js";

export type LegacyCircuitState = {
  state: "open" | "closed" | "half-open";
  failureCount: number;
  lastFailureTime: number | null;
};

export type PredictionFilter = {
  equipmentId?: string;
  orgId?: string;
  limit?: number;
};

export interface MlPredictionServiceShim {
  predict(input: { equipmentId: string; orgId: string }): Promise<MLPredictionResult | null>;
  getPredictions(filter?: PredictionFilter): Promise<MLPredictionResult[]>;
  getCircuitState(): Promise<LegacyCircuitState>;
}

export const mlPredictionService: MlPredictionServiceShim = {
  async predict(_input) {
    return null;
  },
  async getPredictions(_filter) {
    return [];
  },
  async getCircuitState() {
    return { state: "closed", failureCount: 0, lastFailureTime: null };
  },
};

export default mlPredictionService;
