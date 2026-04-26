import type { InferenceContext, InferenceRunnerPort, PredictionScore } from "./ports";

function riskLevelFor(probability: number): PredictionScore["riskLevel"] {
  if (probability > 0.7) {
    return "critical";
  }
  if (probability > 0.4) {
    return "high";
  }
  if (probability > 0.2) {
    return "medium";
  }
  return "low";
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.1;
  }
  return Math.min(Math.max(Math.round(value * 100) / 100, 0), 0.99);
}

/**
 * Deterministic baseline adapter used when no trained model runtime is bound.
 * This keeps the domain service talking to a port while making the heuristic
 * nature explicit and testable.
 */
export class HeuristicInferenceRunner implements InferenceRunnerPort {
  async scoreFeatures({ features }: InferenceContext): Promise<PredictionScore> {
    if (!features) {
      return {
        failureProbability: 0.1,
        riskLevel: "low",
        remainingUsefulLife: 300,
        method: "heuristic-baseline",
        caveat: "Baseline deterministic risk scoring; not a trained PdM model.",
      };
    }

    let score = 0;
    const meanTemp = Number(features.meanTemp ?? 0);
    const rmsVib = Number(features.rmsVibration ?? 0);
    const meanPress = Number(features.meanPressure ?? 0);
    const kurtosis = Number(features.kurtosis ?? 3);

    if (meanTemp > 80) {
      score += 0.25;
    } else if (meanTemp > 65) {
      score += 0.1;
    }

    if (rmsVib > 5) {
      score += 0.3;
    } else if (rmsVib > 3) {
      score += 0.15;
    } else if (rmsVib > 1.5) {
      score += 0.05;
    }

    if (meanPress < 80 || meanPress > 280) {
      score += 0.2;
    } else if (meanPress < 120 || meanPress > 250) {
      score += 0.1;
    }

    if (kurtosis > 5) {
      score += 0.15;
    } else if (kurtosis > 4) {
      score += 0.05;
    }

    const failureProbability = clampProbability(score);
    return {
      failureProbability,
      riskLevel: riskLevelFor(failureProbability),
      remainingUsefulLife: Math.max(Math.floor(365 * (1 - failureProbability)), 7),
      method: "heuristic-baseline",
      caveat: "Baseline deterministic risk scoring; not a trained PdM model.",
    };
  }
}

// Backward-compatible name for older imports/tests.
export const StubInferenceRunner = HeuristicInferenceRunner;
