import { describe, it, expect } from "@jest/globals";
import { failurePredictions } from "@shared/schema/ml-analytics-core";

describe("Prediction Lineage Schema", () => {
  it("failure_predictions has lineage columns (model_version_id, feature_set_version, feature_snapshot_id)", () => {
    const columns = Object.keys((failurePredictions as any));
    expect(columns).toContain("modelVersionId");
    expect(columns).toContain("featureSetVersion");
    expect(columns).toContain("featureSnapshotId");
  });

  it("lineage columns are all string/varchar typed (FK-capable)", () => {
    const modelVersionId = (failurePredictions as any).modelVersionId;
    const featureSetVersion = (failurePredictions as any).featureSetVersion;
    const featureSnapshotId = (failurePredictions as any).featureSnapshotId;
    expect(modelVersionId).toBeDefined();
    expect(featureSetVersion).toBeDefined();
    expect(featureSnapshotId).toBeDefined();
    expect(modelVersionId.columnType).toMatch(/VarChar/i);
    expect(featureSetVersion.columnType).toMatch(/VarChar/i);
    expect(featureSnapshotId.columnType).toMatch(/VarChar/i);
  });
});
