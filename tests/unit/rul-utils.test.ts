import {
  dataQualityScore,
  modeThresholdMultiplier,
  calibrateFailureProb,
} from "../../server/utils/rul-utils";

describe("RUL Engine Utilities", () => {
  describe("dataQualityScore", () => {
    it("returns 1 for perfect data", () => {
      const score = dataQualityScore(500, 30, 0, 0);
      expect(score).toBe(1);
    });

    it("returns low score for poor data", () => {
      const score = dataQualityScore(10, 3, 0.2, 1440);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.5);
    });

    it("caps sample count at 500", () => {
      const at500 = dataQualityScore(500, 30, 0, 0);
      const at1000 = dataQualityScore(1000, 30, 0, 0);
      expect(at500).toBe(at1000);
    });

    it("caps span at 30 days", () => {
      const at30 = dataQualityScore(500, 30, 0, 0);
      const at60 = dataQualityScore(500, 60, 0, 0);
      expect(at30).toBe(at60);
    });

    it("penalizes missing data", () => {
      const noMissing = dataQualityScore(500, 30, 0, 0);
      const halfMissing = dataQualityScore(500, 30, 0.5, 0);
      expect(noMissing).toBeGreaterThan(halfMissing);
    });

    it("penalizes stale data", () => {
      const fresh = dataQualityScore(500, 30, 0, 0);
      const stale = dataQualityScore(500, 30, 0, 720);
      expect(fresh).toBeGreaterThan(stale);
    });

    it("returns 0 freshness after 24h staleness", () => {
      const result = dataQualityScore(500, 30, 0, 1440);
      expect(result).toBeLessThan(1);
    });

    it("is always between 0 and 1", () => {
      const edge1 = dataQualityScore(0, 0, 1, 10000);
      const edge2 = dataQualityScore(10000, 1000, 0, 0);
      expect(edge1).toBeGreaterThanOrEqual(0);
      expect(edge1).toBeLessThanOrEqual(1);
      expect(edge2).toBeGreaterThanOrEqual(0);
      expect(edge2).toBeLessThanOrEqual(1);
    });
  });

  describe("modeThresholdMultiplier", () => {
    it("returns 0.85 for DP (most critical)", () => {
      expect(modeThresholdMultiplier("DP")).toBe(0.85);
    });

    it("returns 0.9 for DOCKING", () => {
      expect(modeThresholdMultiplier("DOCKING")).toBe(0.9);
    });

    it("returns 1 for TRANSIT (baseline)", () => {
      expect(modeThresholdMultiplier("TRANSIT")).toBe(1);
    });

    it("returns 1.2 for STANDBY (most lenient)", () => {
      expect(modeThresholdMultiplier("STANDBY")).toBe(1.2);
    });

    it("returns 1 for UNKNOWN", () => {
      expect(modeThresholdMultiplier("UNKNOWN")).toBe(1);
    });

    it("maintains strict ordering: DP < DOCKING < CARGO_OPS < TRANSIT < HARBOR < STANDBY", () => {
      const dp = modeThresholdMultiplier("DP");
      const docking = modeThresholdMultiplier("DOCKING");
      const cargo = modeThresholdMultiplier("CARGO_OPS");
      const transit = modeThresholdMultiplier("TRANSIT");
      const harbor = modeThresholdMultiplier("HARBOR");
      const standby = modeThresholdMultiplier("STANDBY");
      expect(dp).toBeLessThan(docking);
      expect(docking).toBeLessThan(cargo);
      expect(cargo).toBeLessThan(transit);
      expect(transit).toBeLessThan(harbor);
      expect(harbor).toBeLessThan(standby);
    });
  });

  describe("calibrateFailureProb", () => {
    it("pulls overconfident predictions toward base rate", () => {
      const calibrated = calibrateFailureProb(0.95, 0.15);
      expect(calibrated).toBeLessThan(0.95);
      expect(calibrated).toBeGreaterThan(0.15);
    });

    it("pulls underconfident predictions toward base rate", () => {
      const calibrated = calibrateFailureProb(0.05, 0.3);
      expect(calibrated).toBeGreaterThan(0.05);
    });

    it("clamps to minimum 0.01", () => {
      const calibrated = calibrateFailureProb(0, 0);
      expect(calibrated).toBeGreaterThanOrEqual(0.01);
    });

    it("clamps to maximum 0.99", () => {
      const calibrated = calibrateFailureProb(1, 1);
      expect(calibrated).toBeLessThanOrEqual(0.99);
    });

    it("applies 80/20 blend formula", () => {
      const p = 0.95;
      const baseRate = 0.15;
      const expected = 0.8 * p + 0.2 * baseRate;
      expect(calibrateFailureProb(p, baseRate)).toBeCloseTo(expected, 5);
    });

    it("does not change when p equals base rate", () => {
      const result = calibrateFailureProb(0.5, 0.5);
      expect(result).toBeCloseTo(0.5, 5);
    });
  });
});
