/**
 * Forms batch 5 — ML/optimization form schemas.
 *
 * Covers the zod coercion that used to live in the dialog submit
 * handlers (parseInt/parseFloat): string→number round-trips, rejection
 * of garbage/out-of-range input, and the optional rowCount
 * empty-string→undefined preprocess. Also covers the RunDialog
 * time-horizon schema (1-365, default 90).
 */
import {
  createDatasetSchema,
  startRunSchema,
  promoteSchema,
} from "@/pages/pdm-platform/trainingPipelineSchemas";
import { runOptimizationFormSchema } from "@/pages/optimization-tools/runOptimizationSchema";

describe("startRunSchema", () => {
  const valid = {
    datasetId: "ds-1",
    learningRate: "0.001",
    epochs: "50",
    batchSize: "32",
  };

  it("round-trips string hyperparameters to numbers", () => {
    const result = startRunSchema.parse(valid);
    expect(result).toEqual({
      datasetId: "ds-1",
      learningRate: 0.001,
      epochs: 50,
      batchSize: 32,
    });
  });

  it("requires a dataset id", () => {
    expect(startRunSchema.safeParse({ ...valid, datasetId: "" }).success).toBe(false);
  });

  it("rejects non-numeric learning rate", () => {
    expect(startRunSchema.safeParse({ ...valid, learningRate: "abc" }).success).toBe(false);
  });

  it("rejects learning rate above 1", () => {
    const result = startRunSchema.safeParse({ ...valid, learningRate: "1.5" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Must be between 0 and 1");
    }
  });

  it("rejects zero and negative learning rate", () => {
    expect(startRunSchema.safeParse({ ...valid, learningRate: "0" }).success).toBe(false);
    expect(startRunSchema.safeParse({ ...valid, learningRate: "-0.5" }).success).toBe(false);
  });

  it("rejects negative, zero, and fractional epochs", () => {
    expect(startRunSchema.safeParse({ ...valid, epochs: "-5" }).success).toBe(false);
    expect(startRunSchema.safeParse({ ...valid, epochs: "0" }).success).toBe(false);
    expect(startRunSchema.safeParse({ ...valid, epochs: "1.5" }).success).toBe(false);
  });

  it("rejects non-numeric and negative batch size", () => {
    expect(startRunSchema.safeParse({ ...valid, batchSize: "abc" }).success).toBe(false);
    expect(startRunSchema.safeParse({ ...valid, batchSize: "-32" }).success).toBe(false);
  });
});

describe("createDatasetSchema", () => {
  const valid = {
    name: "Engine Telemetry Q4 2024",
    sourceType: "telemetry",
    description: "",
    labelColumn: "failure",
    rowCount: "",
  };

  it("requires name and sourceType", () => {
    expect(createDatasetSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(createDatasetSchema.safeParse({ ...valid, sourceType: "" }).success).toBe(false);
  });

  it("treats an empty rowCount as undefined", () => {
    const result = createDatasetSchema.parse(valid);
    expect(result.rowCount).toBeUndefined();
  });

  it("round-trips a rowCount string to a positive integer", () => {
    const result = createDatasetSchema.parse({ ...valid, rowCount: "10000" });
    expect(result.rowCount).toBe(10000);
  });

  it("rejects non-numeric, negative, and fractional rowCount", () => {
    expect(createDatasetSchema.safeParse({ ...valid, rowCount: "abc" }).success).toBe(false);
    expect(createDatasetSchema.safeParse({ ...valid, rowCount: "-10" }).success).toBe(false);
    expect(createDatasetSchema.safeParse({ ...valid, rowCount: "10.5" }).success).toBe(false);
  });
});

describe("promoteSchema", () => {
  it("requires modelId and version", () => {
    const result = promoteSchema.safeParse({ modelId: "", version: "", changelog: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("modelId");
      expect(fields).toContain("version");
    }
  });

  it("accepts a valid payload with an optional changelog", () => {
    expect(promoteSchema.parse({ modelId: "model-1", version: "2.1.0", changelog: "" })).toEqual({
      modelId: "model-1",
      version: "2.1.0",
      changelog: "",
    });
    expect(promoteSchema.safeParse({ modelId: "model-1", version: "2.1.0" }).success).toBe(true);
  });
});

describe("runOptimizationFormSchema", () => {
  it("defaults the time horizon to 90", () => {
    expect(runOptimizationFormSchema.parse({})).toEqual({ timeHorizon: 90 });
  });

  it("round-trips a string time horizon to a number", () => {
    expect(runOptimizationFormSchema.parse({ timeHorizon: "30" })).toEqual({
      timeHorizon: 30,
    });
  });

  it("enforces the 1-365 day bounds", () => {
    expect(runOptimizationFormSchema.safeParse({ timeHorizon: "0" }).success).toBe(false);
    expect(runOptimizationFormSchema.safeParse({ timeHorizon: "366" }).success).toBe(false);
    expect(runOptimizationFormSchema.safeParse({ timeHorizon: "1" }).success).toBe(true);
    expect(runOptimizationFormSchema.safeParse({ timeHorizon: "365" }).success).toBe(true);
  });

  it("rejects non-numeric and fractional values", () => {
    expect(runOptimizationFormSchema.safeParse({ timeHorizon: "abc" }).success).toBe(false);
    expect(runOptimizationFormSchema.safeParse({ timeHorizon: "90.5" }).success).toBe(false);
  });
});
