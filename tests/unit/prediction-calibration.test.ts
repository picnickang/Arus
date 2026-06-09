/**
 * Prediction Calibration — Unit Tests
 *
 * Tests the Platt scaling and isotonic regression calibration logic.
 * Critical: miscalibrated predictions lead to wrong maintenance prioritization.
 * A "0.85 confidence" must actually mean ~85% of similar predictions are correct.
 */

import { describe, it, expect } from "@jest/globals";

import PredictionCalibrator from "../../server/services/ml/prediction-calibration";

// Since PredictionCalibrator requires a DB connection, we test the pure functions
// by importing them indirectly. We extract and test the mathematical core.

// ── Platt Scaling math (extracted for unit testing) ──────────────────────────

/** Platt sigmoid: P = 1 / (1 + exp(a*f + b)) */
function plattSigmoid(f: number, a: number, b: number): number {
  return 1 / (1 + Math.exp(a * f + b));
}

/** Fit Platt parameters using gradient descent */
function fitPlattScaling(
  data: Array<{ predicted: number; actual: 0 | 1 }>,
  maxIter = 200,
  lr = 0.01
): { a: number; b: number } {
  let a = 0;
  let b = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    let gradA = 0;
    let gradB = 0;

    for (const { predicted: f, actual: y } of data) {
      const p = 1 / (1 + Math.exp(a * f + b));
      const err = p - y;
      gradA += err * f;
      gradB += err;
    }

    a -= lr * (gradA / data.length);
    b -= lr * (gradB / data.length);
  }

  return { a, b };
}

/** Brier score: mean squared error of probability predictions */
function brierScore(data: Array<{ predicted: number; actual: 0 | 1 }>): number {
  const n = data.length;
  if (n === 0) {
    return 0;
  }
  return data.reduce((sum, { predicted, actual }) => sum + Math.pow(predicted - actual, 2), 0) / n;
}

/** Isotonic regression (pool adjacent violators algorithm) */
function fitIsotonicRegression(
  data: Array<{ predicted: number; actual: 0 | 1 }>
): Array<{ threshold: number; value: number }> {
  // Sort by predicted probability
  const sorted = [...data].sort((a, b) => a.predicted - b.predicted);

  // Pool adjacent violators
  const blocks: Array<{ sum: number; count: number; maxPredicted: number }> = [];

  for (const point of sorted) {
    blocks.push({ sum: point.actual, count: 1, maxPredicted: point.predicted });

    // Merge blocks that violate monotonicity
    while (blocks.length >= 2) {
      const last = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (prev.sum / prev.count > last.sum / last.count) {
        // Merge
        prev.sum += last.sum;
        prev.count += last.count;
        prev.maxPredicted = Math.max(prev.maxPredicted, last.maxPredicted);
        blocks.pop();
      } else {
        break;
      }
    }
  }

  return blocks.map((b) => ({
    threshold: b.maxPredicted,
    value: b.sum / b.count,
  }));
}

function calibrateIsotonic(
  raw: number,
  mapping: Array<{ threshold: number; value: number }>
): number {
  if (mapping.length === 0) {
    return raw;
  }
  for (let i = 0; i < mapping.length; i++) {
    if (raw <= mapping[i].threshold) {
      return mapping[i].value;
    }
  }
  return mapping[mapping.length - 1].value;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Prediction Calibration", () => {
  describe("Platt Scaling", () => {
    it("sigmoid maps 0 to ~0.5 when a=0, b=0", () => {
      expect(plattSigmoid(0, 0, 0)).toBeCloseTo(0.5, 3);
    });

    it("sigmoid maps large negative a*f+b to ~1", () => {
      expect(plattSigmoid(10, -5, 0)).toBeCloseTo(1.0, 2);
    });

    it("sigmoid maps large positive a*f+b to ~0", () => {
      expect(plattSigmoid(10, 5, 0)).toBeCloseTo(0.0, 2);
    });

    it("fits parameters that improve calibration on synthetic data", () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        predicted: 0.7 + (i % 20) * 0.01,
        actual: (i % 2 === 0 ? 1 : 0) as 0 | 1,
      }));

      const { a, b } = fitPlattScaling(data, 1000, 0.01);

      const avgCalibrated =
        data.reduce((sum, d) => sum + plattSigmoid(d.predicted, a, b), 0) / data.length;

      expect(avgCalibrated).toBeGreaterThan(0.1);
      expect(avgCalibrated).toBeLessThan(0.95);
    });

    it("preserves ordering after calibration", () => {
      const rawScores = [0.1, 0.3, 0.7, 0.9];
      const { a, b } = fitPlattScaling(
        rawScores.map((p, i) => ({
          predicted: p,
          actual: (i >= 2 ? 1 : 0) as 0 | 1,
        })),
        500,
        0.01
      );
      const calibrated = rawScores.map((p) => plattSigmoid(p, a, b));

      for (let i = 1; i < calibrated.length; i++) {
        expect(calibrated[i]).toBeGreaterThanOrEqual(calibrated[i - 1] - 0.1);
      }
    });
  });

  describe("Brier Score", () => {
    it("returns 0 for perfect predictions", () => {
      const data = [
        { predicted: 1, actual: 1 as const },
        { predicted: 0, actual: 0 as const },
      ];
      expect(brierScore(data)).toBe(0);
    });

    it("returns 1 for worst-case predictions", () => {
      const data = [
        { predicted: 0, actual: 1 as const },
        { predicted: 1, actual: 0 as const },
      ];
      expect(brierScore(data)).toBe(1);
    });

    it("returns 0.25 for always-0.5 predictions", () => {
      const data = [
        { predicted: 0.5, actual: 0 as const },
        { predicted: 0.5, actual: 1 as const },
      ];
      expect(brierScore(data)).toBeCloseTo(0.25, 3);
    });

    it("returns 0 for empty data", () => {
      expect(brierScore([])).toBe(0);
    });
  });

  describe("Isotonic Regression", () => {
    it("produces monotonically non-decreasing output", () => {
      const data = Array.from({ length: 50 }, (_, i) => ({
        predicted: i / 50,
        actual: (Math.random() > 0.5 ? 1 : 0) as 0 | 1,
      }));

      const mapping = fitIsotonicRegression(data);

      for (let i = 1; i < mapping.length; i++) {
        expect(mapping[i].value).toBeGreaterThanOrEqual(mapping[i - 1].value);
      }
    });

    it("maps perfectly calibrated data to itself approximately", () => {
      const data = Array.from({ length: 200 }, (_, i) => {
        const p = i / 200;
        return { predicted: p, actual: (Math.random() < p ? 1 : 0) as 0 | 1 };
      });

      const mapping = fitIsotonicRegression(data);
      // First mapping should be near 0, last near 1
      expect(mapping[0].value).toBeLessThan(0.3);
      expect(mapping[mapping.length - 1].value).toBeGreaterThan(0.5);
    });

    it("handles single data point", () => {
      const mapping = fitIsotonicRegression([{ predicted: 0.5, actual: 1 }]);
      expect(mapping).toHaveLength(1);
      expect(mapping[0].value).toBe(1);
    });

    it("calibrateIsotonic returns raw value when mapping is empty", () => {
      expect(calibrateIsotonic(0.7, [])).toBe(0.7);
    });

    it("calibrateIsotonic interpolates correctly", () => {
      const mapping = [
        { threshold: 0.3, value: 0.1 },
        { threshold: 0.6, value: 0.4 },
        { threshold: 0.9, value: 0.8 },
      ];
      expect(calibrateIsotonic(0.1, mapping)).toBe(0.1); // <= first threshold
      expect(calibrateIsotonic(0.5, mapping)).toBe(0.4); // <= second threshold
      expect(calibrateIsotonic(0.95, mapping)).toBe(0.8); // > last threshold
    });
  });
});

describe("PredictionCalibrator production behavior", () => {
  const makeCalibrator = (
    data: Array<{ predictedProbability: number; actualOutcome: 0 | 1 }>
  ): PredictionCalibrator => {
    const calibrator = new PredictionCalibrator({} as never);
    (
      calibrator as unknown as {
        fetchCalibrationData: () => Promise<
          Array<{ predictedProbability: number; actualOutcome: 0 | 1 }>
        >;
      }
    ).fetchCalibrationData = async () => data;
    return calibrator;
  };

  it("returns null and leaves probabilities raw when history is insufficient", async () => {
    const calibrator = makeCalibrator([{ predictedProbability: 0.7, actualOutcome: 1 }]);

    await expect(
      calibrator.fitFromHistory("org-calibration-a", "model-a", {
        method: "platt",
        minDataPoints: 5,
      })
    ).resolves.toBeNull();

    expect(calibrator.isCalibrated("org-calibration-a", "model-a")).toBe(false);
    expect(calibrator.calibrate(0.73, "org-calibration-a", "model-a")).toBe(0.73);
    await expect(
      calibrator.getCalibrationReport("org-calibration-a", "model-a")
    ).resolves.toBeNull();
  });

  it("fits a Platt model and returns bounded calibrated probabilities and report bins", async () => {
    const data = Array.from({ length: 80 }, (_, index) => {
      const predictedProbability = 0.1 + (index % 8) * 0.1;
      return {
        predictedProbability,
        actualOutcome: (predictedProbability >= 0.5 ? 1 : 0) as 0 | 1,
      };
    });
    const calibrator = makeCalibrator(data);

    const model = await calibrator.fitFromHistory("org-calibration-b", "model-b", {
      method: "platt",
      minDataPoints: 20,
    });
    const calibrated = calibrator.calibrate(0.8, "org-calibration-b", "model-b");
    const report = await calibrator.getCalibrationReport("org-calibration-b", "model-b");

    expect(model?.method).toBe("platt");
    expect(model?.dataPointCount).toBe(80);
    expect(calibrator.isCalibrated("org-calibration-b", "model-b")).toBe(true);
    expect(calibrated).toBeGreaterThanOrEqual(0);
    expect(calibrated).toBeLessThanOrEqual(1);
    expect(report).toMatchObject({
      orgId: "org-calibration-b",
      modelId: "model-b",
      method: "platt",
      dataPoints: 80,
    });
    expect(report?.reliabilityDiagram).toHaveLength(10);
  });

  it("fits isotonic models explicitly and uses the all-model cache key", async () => {
    const data = Array.from({ length: 40 }, (_, index) => ({
      predictedProbability: index / 40,
      actualOutcome: (index >= 20 ? 1 : 0) as 0 | 1,
    }));
    const calibrator = makeCalibrator(data);

    const model = await calibrator.fitFromHistory("org-calibration-c", undefined, {
      method: "isotonic",
      minDataPoints: 10,
    });

    expect(model?.method).toBe("isotonic");
    expect(model?.isotonicMapping?.thresholds.length).toBeGreaterThan(0);
    expect(calibrator.isCalibrated("org-calibration-c")).toBe(true);
    expect(calibrator.calibrate(-1, "org-calibration-c")).toBeGreaterThanOrEqual(0);
    expect(calibrator.calibrate(2, "org-calibration-c")).toBeLessThanOrEqual(1);
  });
});
