import { calculateSummaryStats, calculateKurtosis, calculateSkewness, detectIQRAnomalies, percentile, calculateStd } from "../../server/utils/statistics";

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
});
