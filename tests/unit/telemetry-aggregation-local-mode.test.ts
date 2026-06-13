import { describe, expect, it } from "@jest/globals";
import { canEnsureAggregationTable } from "../../server/services/telemetry-aggregation/telemetry-aggregator";

describe("telemetry aggregation local-mode startup guard", () => {
  it("rejects local SQLite runner objects that do not expose PostgreSQL-style execute", () => {
    expect(canEnsureAggregationTable({ run: async () => undefined })).toBe(false);
  });

  it("accepts database clients that expose the execute method required by the aggregator", () => {
    expect(canEnsureAggregationTable({ execute: async () => ({ rows: [] }) })).toBe(true);
  });
});
