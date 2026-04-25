import {
  calculateFailureProbability,
  calculateReliability,
  predictRUL,
} from "../../weibull-rul/reliability-calculations";
import { calculateWeibullGoodnessOfFit } from "../../weibull-rul/parameter-estimation";

describe("Weibull RUL reliability calculations", () => {
  const params = { shape: 2, scale: 100, location: 0, rsquared: 0.9 };

  it("returns bounded reliability and decreases with age", () => {
    const early = calculateReliability(10, params);
    const late = calculateReliability(90, params);

    expect(early).toBeGreaterThan(late);
    expect(early).toBeLessThanOrEqual(1);
    expect(late).toBeGreaterThanOrEqual(0);
  });

  it("predicts non-negative RUL", () => {
    expect(predictRUL(50, params, 0.1)).toBeGreaterThanOrEqual(0);
  });

  it("calculates interval failure probability from reliability delta", () => {
    const probability = calculateFailureProbability(10, 90, params);
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThanOrEqual(1);
  });

  it("uses x and y variance in goodness-of-fit correlation", () => {
    const r2 = calculateWeibullGoodnessOfFit([20, 40, 80, 120, 180], 1.8, 95, 0);
    expect(r2).toBeGreaterThanOrEqual(0.3);
    expect(r2).toBeLessThanOrEqual(0.99);
  });
});
