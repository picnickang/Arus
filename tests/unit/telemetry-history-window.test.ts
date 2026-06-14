/**
 * Regression: GET /api/telemetry/history/:equipmentId/:sensorType must treat
 * `hours` as a TIME WINDOW, not a row-count limit.
 *
 * The route used to call getTelemetryHistory(equipmentId, sensorType, hours),
 * but that storage method's third positional arg is `limit` — so `?hours=24`
 * silently capped the result to 24 rows with no time filtering at all. The fix
 * routes through getTelemetryByEquipmentAndDateRange with a computed window.
 */
import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import express from "express";
import request from "supertest";

const getByRangeMock = jest.fn(
  async (
    _equipmentId: string,
    _startDate: Date,
    _endDate: Date,
    _sensorType?: string
  ): Promise<unknown[]> => []
);
const getHistoryMock = jest.fn(async (): Promise<unknown[]> => []);

let app: express.Express;

beforeAll(async () => {
  jest.unstable_mockModule("../../server/db/telemetry/index.js", () => ({
    __esModule: true,
    dbTelemetryStorage: {
      getTelemetryByEquipmentAndDateRange: getByRangeMock,
      getTelemetryHistory: getHistoryMock,
    },
  }));
  jest.unstable_mockModule("../../server/lib/event-spine/analytics-sink-reader.js", () => ({
    __esModule: true,
    analyticsReadMode: () => "oltp",
    readTelemetryFromSink: jest.fn(async () => []),
  }));

  const { registerTelemetryRoutes } = await import(
    "../../server/domains/sensor-management/routes/telemetry-routes"
  );

  const passthrough: express.RequestHandler = (_req, _res, next) => next();
  const requireOrgId: express.RequestHandler = (req, _res, next) => {
    (req as express.Request & { orgId?: string }).orgId = "org-test";
    next();
  };

  app = express();
  registerTelemetryRoutes(app, {
    requireOrgId,
    generalApiRateLimit: passthrough,
    writeOperationRateLimit: passthrough,
    criticalOperationRateLimit: passthrough,
  });
});

beforeEach(() => {
  getByRangeMock.mockReset();
  getByRangeMock.mockResolvedValue([]);
  getHistoryMock.mockReset();
  getHistoryMock.mockResolvedValue([]);
});

describe("GET /api/telemetry/history/:equipmentId/:sensorType", () => {
  it("queries a time window (hours), not a row-count limit", async () => {
    const res = await request(app).get("/api/telemetry/history/eq-1/temperature?hours=6");

    expect(res.status).toBe(200);
    expect(getByRangeMock).toHaveBeenCalledTimes(1);
    // The old, buggy path (hours-as-limit) must not be used.
    expect(getHistoryMock).not.toHaveBeenCalled();

    const call = getByRangeMock.mock.calls.at(0);
    expect(call).toBeDefined();
    if (!call) {
      return;
    }
    expect(call[0]).toBe("eq-1");
    expect(call[3]).toBe("temperature");
    const windowHours = (call[2].getTime() - call[1].getTime()) / (60 * 60 * 1000);
    expect(Math.round(windowHours)).toBe(6);
  });

  it("defaults to a 24-hour window when hours is omitted", async () => {
    await request(app).get("/api/telemetry/history/eq-1/temperature");

    const call = getByRangeMock.mock.calls.at(0);
    expect(call).toBeDefined();
    if (!call) {
      return;
    }
    const windowHours = (call[2].getTime() - call[1].getTime()) / (60 * 60 * 1000);
    expect(Math.round(windowHours)).toBe(24);
  });
});
