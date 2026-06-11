import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  matchFailureSignature,
  normalizeSensorType,
} from "../../server/services/anomaly-correlation/anomaly-signatures";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("server tail extractions", () => {
  it("keeps anomaly signature matching behavior in a pure helper", () => {
    expect(normalizeSensorType("main_vibration_sensor")).toBe("vibration");
    expect(normalizeSensorType("fuel-consumption")).toBe("fuel_consumption");

    const match = matchFailureSignature(["vibration", "temperature", "oil_analysis"]);

    expect(match).toMatchObject({
      diagnosis: "Bearing degradation detected",
      rootCause: "Bearing wear, misalignment, or lubrication failure",
      severity: "high",
      confidence: 0.85,
    });
  });

  it("keeps prediction outcome tracker data shapes in a sibling type module", () => {
    const tracker = read("server/services/ml/prediction-outcome-tracker.ts");
    const types = read("server/services/ml/prediction-outcome-tracker-types.ts");

    expect(tracker).toContain('from "./prediction-outcome-tracker-types"');
    expect(tracker).toContain("export class PredictionOutcomeTracker");
    expect(types).toContain("export const DEFAULT_CONFIG");
    expect(types).toContain("export interface OutcomeEvaluationReport");
    expect(types).toContain("export interface EligiblePrediction");
  });
});
