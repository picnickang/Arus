import { HeuristicInferenceRunner } from "../../domains/pdm-platform/inference/stub-runner";

describe("HeuristicInferenceRunner", () => {
  it("scores through the inference port without database coupling", async () => {
    const runner = new HeuristicInferenceRunner();
    const result = await runner.scoreFeatures({
      orgId: "default-org-id",
      equipmentId: "pump-1",
      features: {
        meanTemp: 82,
        rmsVibration: 5.5,
        meanPressure: 300,
        kurtosis: 5.5,
      },
    });

    expect(result.failureProbability).toBeGreaterThan(0.7);
    expect(result.riskLevel).toBe("critical");
    expect(result.remainingUsefulLife).toBeGreaterThanOrEqual(7);
  });
});
