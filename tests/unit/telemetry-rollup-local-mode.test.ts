import { beforeAll, describe, expect, it, jest } from "@jest/globals";

const ensureTableMock = jest.fn(async () => undefined);
const runScheduledMock = jest.fn(async () => ({
  minute: { bucketsCreated: 0 },
  hour: { bucketsCreated: 0 },
  day: { bucketsCreated: 0 },
}));
const cleanupMock = jest.fn(async () => ({ minuteDeleted: 0, hourDeleted: 0 }));

let processTelemetryRollup: (typeof import("../../server/job-processors/telemetry-rollup-processor"))["processTelemetryRollup"];

beforeAll(async () => {
  jest.unstable_mockModule("../../server/db", () => ({
    __esModule: true,
    db: {},
    pool: null,
    libsqlClient: {},
    isLocalMode: true,
    deploymentMode: "VESSEL",
  }));
  jest.unstable_mockModule("../../server/middleware/db-context", () => ({
    __esModule: true,
    withTenantContext: jest.fn(async (_orgId: string, fn: () => Promise<unknown>) => fn()),
  }));
  jest.unstable_mockModule(
    "../../server/services/telemetry-aggregation/telemetry-aggregator",
    () => ({
      __esModule: true,
      TelemetryAggregator: class {
        ensureTable = ensureTableMock;
        runScheduledAggregation = runScheduledMock;
        cleanupOldAggregations = cleanupMock;
      },
    })
  );

  ({ processTelemetryRollup } = await import(
    "../../server/job-processors/telemetry-rollup-processor"
  ));
});

describe("processTelemetryRollup in local SQLite mode", () => {
  it("no-ops because the rollup SQL is PostgreSQL-specific", async () => {
    const summary = await processTelemetryRollup();

    expect(summary).toMatchObject({
      orgsTotal: 0,
      orgsSucceeded: 0,
      orgsFailed: 0,
      bucketsCreated: 0,
      minuteDeleted: 0,
      hourDeleted: 0,
      failures: [],
      skipped: "local-mode",
    });
    expect(ensureTableMock).not.toHaveBeenCalled();
    expect(runScheduledMock).not.toHaveBeenCalled();
    expect(cleanupMock).not.toHaveBeenCalled();
  });
});
