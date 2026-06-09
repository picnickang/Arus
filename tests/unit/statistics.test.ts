import {
  calculateSummaryStats,
  calculateKurtosis,
  calculateSkewness,
  detectIQRAnomalies,
  detectZScoreAnomalies,
  percentile,
  calculateStd,
  zScore,
  clampSigma,
  calculateRMS,
  absEnvelope,
  bandRMS,
  linearRegression,
  movingAverage,
  exponentialMovingAverage,
  calculateAutocorrelation,
  calculatePearsonCorrelation,
  classifyCorrelationStrength,
  shapiroWilkTest,
  linearForecast,
  exponentialSmoothing,
  calculateMAE,
  calculateRMSE,
  calculateMAPE,
} from "../../server/utils/statistics";

describe("Statistical Utilities", () => {
  describe("calculateSummaryStats", () => {
    it("returns zeros for empty array", () => {
      const result = calculateSummaryStats([]);
      expect(result.count).toBe(0);
      expect(result.mean).toBe(0);
      expect(result.std).toBe(0);
    });

    it("calculates correct stats for known values", () => {
      const result = calculateSummaryStats([1, 2, 3, 4, 5]);
      expect(result.count).toBe(5);
      expect(result.mean).toBe(3);
      expect(result.min).toBe(1);
      expect(result.max).toBe(5);
      expect(result.median).toBe(3);
    });

    it("calculates std correctly", () => {
      const result = calculateSummaryStats([10, 10, 10, 10]);
      expect(result.std).toBe(0);
    });
  });

  describe("percentile", () => {
    it("returns 0 for empty array", () => {
      expect(percentile([], 0.5)).toBe(0);
    });

    it("returns median for p=0.5", () => {
      const result = percentile([1, 2, 3, 4, 5], 0.5);
      expect(result).toBe(3);
    });
  });

  describe("calculateStd", () => {
    it("returns 0 for empty array", () => {
      expect(calculateStd([])).toBe(0);
    });

    it("returns 0 for uniform values", () => {
      expect(calculateStd([5, 5, 5, 5])).toBe(0);
    });

    it("returns positive value for varying data", () => {
      expect(calculateStd([1, 2, 3, 4, 5])).toBeGreaterThan(0);
    });
  });

  describe("calculateKurtosis", () => {
    it("returns 0 for fewer than 4 values", () => {
      expect(calculateKurtosis([1, 2, 3])).toBe(0);
    });

    it("returns near 0 for normal-like distribution", () => {
      const normal = [2, 3, 3, 4, 4, 4, 5, 5, 6];
      const kurtosis = calculateKurtosis(normal);
      expect(Math.abs(kurtosis)).toBeLessThan(3);
    });

    it("returns negative excess kurtosis for uniform data", () => {
      const uniform = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const kurtosis = calculateKurtosis(uniform);
      expect(kurtosis).toBeLessThan(0);
    });
  });

  describe("calculateSkewness", () => {
    it("returns 0 for fewer than 3 values", () => {
      expect(calculateSkewness([1, 2])).toBe(0);
    });

    it("returns near 0 for symmetric data", () => {
      const symmetric = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const skewness = calculateSkewness(symmetric);
      expect(Math.abs(skewness)).toBeLessThan(0.5);
    });

    it("returns positive skewness for right-skewed data", () => {
      const rightSkewed = [1, 1, 1, 2, 2, 3, 10, 20, 50];
      const skewness = calculateSkewness(rightSkewed);
      expect(skewness).toBeGreaterThan(0);
    });
  });

  describe("detectIQRAnomalies", () => {
    it("detects outliers using IQR method", () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
      const results = detectIQRAnomalies(data);
      const anomalies = results.filter((r) => r.isAnomaly);
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].value).toBe(100);
    });

    it("returns no anomalies for uniform data", () => {
      const data = [5, 5, 5, 5, 5, 5, 5, 5];
      const results = detectIQRAnomalies(data);
      const anomalies = results.filter((r) => r.isAnomaly);
      expect(anomalies.length).toBe(0);
    });

    it("stricter multiplier detects more anomalies", () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 15];
      const standard = detectIQRAnomalies(data, 1.5).filter((r) => r.isAnomaly);
      const strict = detectIQRAnomalies(data, 1.0).filter((r) => r.isAnomaly);
      expect(strict.length).toBeGreaterThanOrEqual(standard.length);
    });

    it("includes deviation and bounds in results", () => {
      const data = [1, 2, 3, 4, 5, 100];
      const results = detectIQRAnomalies(data);
      const anomaly = results.find((r) => r.isAnomaly);
      expect(anomaly).toBeDefined();
      expect(anomaly!.deviation).toBeGreaterThan(0);
      expect(anomaly!.lowerBound).toBeDefined();
      expect(anomaly!.upperBound).toBeDefined();
    });
  });

  describe("Z-score anomaly helpers", () => {
    it("detects large z-score deviations and reports distance from the mean", () => {
      const results = detectZScoreAnomalies([10, 11, 10, 9, 100], 1.5);
      const anomaly = results.find((r) => r.value === 100);

      expect(anomaly?.isAnomaly).toBe(true);
      expect(anomaly?.zScore).toBeGreaterThan(1.5);
      expect(anomaly?.deviation).toBeGreaterThan(50);
    });

    it("calculates and clamps sigma values safely", () => {
      expect(zScore(15, 10, 2.5)).toBe(2);
      expect(zScore(15, 10, 0)).toBe(0);
      expect(clampSigma(Number.POSITIVE_INFINITY)).toBe(0);
      expect(clampSigma(25)).toBe(10);
      expect(clampSigma(-25)).toBe(-10);
      expect(clampSigma(2.5)).toBe(2.5);
    });
  });

  describe("signal processing helpers", () => {
    it("calculates RMS for vibration-like samples", () => {
      expect(calculateRMS([])).toBe(0);
      expect(calculateRMS([3, 4])).toBeCloseTo(Math.sqrt(12.5), 6);
    });

    it("computes a rectified moving envelope with edge windows", () => {
      expect(absEnvelope([])).toEqual([]);
      expect(absEnvelope([-2, 4, -6], 1)).toEqual([3, 4, 5]);
    });

    it("calculates band RMS from frequency and magnitude buckets", () => {
      const result = bandRMS(
        [5, 15, 25, 35],
        [3, 4, 6, 8],
        [
          { name: "low", lo: 0, hi: 20 },
          { name: "high", lo: 20, hi: 40 },
          { name: "empty", lo: 100, hi: 200 },
        ]
      );

      expect(result[0]).toEqual({ name: "low", value: Math.sqrt(12.5) });
      expect(result[1]).toEqual({ name: "high", value: Math.sqrt(50) });
      expect(result[2]).toEqual({ name: "empty", value: 0 });
    });
  });

  describe("time-series helpers", () => {
    it("fits a perfect linear trend and forecasts future points", () => {
      const regression = linearRegression([0, 1, 2, 3], [1, 3, 5, 7]);

      expect(regression.slope).toBeCloseTo(2, 6);
      expect(regression.intercept).toBeCloseTo(1, 6);
      expect(regression.rSquared).toBeCloseTo(1, 6);
      expect(linearForecast([1, 3, 5, 7], 2)).toEqual([9, 11]);
    });

    it("computes moving averages and exponential smoothing forecasts", () => {
      expect(movingAverage([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
      expect(exponentialMovingAverage([], 0.5)).toEqual([]);
      expect(exponentialMovingAverage([10, 20, 30], 0.5)).toEqual([10, 15, 22.5]);
      expect(exponentialSmoothing([], 0.5, 2)).toEqual([]);
      expect(exponentialSmoothing([10, 20, 30], 0.5, 2)).toEqual([22.5, 22.5]);
    });

    it("calculates autocorrelation and rejects invalid lags", () => {
      expect(calculateAutocorrelation([1, 2, 3], 3)).toBe(0);
      expect(calculateAutocorrelation([1, 2, 3], -1)).toBe(0);
      expect(calculateAutocorrelation([5, 5, 5], 1)).toBe(0);
      expect(calculateAutocorrelation([1, 2, 3, 4], 1)).toBeGreaterThan(0);
    });
  });

  describe("correlation and normality helpers", () => {
    it("calculates Pearson correlation across unequal-length series", () => {
      expect(calculatePearsonCorrelation([], [])).toBe(0);
      expect(calculatePearsonCorrelation([1, 2, 3], [2, 4, 6, 100])).toBeCloseTo(1, 6);
      expect(calculatePearsonCorrelation([1, 1, 1], [2, 3, 4])).toBe(0);
    });

    it("classifies correlation strength by absolute magnitude", () => {
      expect(classifyCorrelationStrength(0.1)).toBe("none");
      expect(classifyCorrelationStrength(0.3)).toBe("weak");
      expect(classifyCorrelationStrength(0.5)).toBe("moderate");
      expect(classifyCorrelationStrength(0.7)).toBe("strong");
      expect(classifyCorrelationStrength(-0.9)).toBe("very-strong");
    });

    it("returns normality confidence for short and skewed samples", () => {
      expect(shapiroWilkTest([1, 2])).toEqual({ isNormal: true, confidence: 0 });

      const skewed = shapiroWilkTest([1, 1, 1, 2, 2, 10, 25, 80]);
      expect(skewed.confidence).toBeGreaterThanOrEqual(0);
      expect(skewed.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("forecast error helpers", () => {
    it("calculates MAE, RMSE, and MAPE over aligned prediction windows", () => {
      expect(calculateMAE([], [])).toBe(0);
      expect(calculateRMSE([], [])).toBe(0);
      expect(calculateMAPE([], [])).toBe(0);

      expect(calculateMAE([10, 20, 30], [12, 18, 33])).toBeCloseTo(7 / 3, 6);
      expect(calculateRMSE([10, 20, 30], [12, 18, 33])).toBeCloseTo(Math.sqrt(17 / 3), 6);
      expect(calculateMAPE([0, 20, 40], [10, 18, 44])).toBeCloseTo(10, 6);
    });
  });
});
