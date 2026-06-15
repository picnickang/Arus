import { describe, expect, it } from "@jest/globals";
import { buildFmccSnapshot } from "../../server/integrations/fmcc-snapshot-builder";
import type { FmccPollingConfig, FmccRawPollData } from "../../server/integrations/fmcc-types";

const config: FmccPollingConfig = {
  enabled: true,
  vesselId: "vessel-1",
  orgId: "org-1",
  pollIntervalMs: 60000,
  enableTrackLogging: true,
  enableTelemetryLogging: true,
  minPositionChangeNm: 0.05,
  maxTrackGapMinutes: 5,
};

describe("buildFmccSnapshot", () => {
  it("normalizes nested and flat FMCC poll payloads without the polling service", () => {
    const data: FmccRawPollData = {
      fuel: {
        foNetFlowKgPerH: 125,
        foFlowKgPerH: 120,
        doFlowKgPerH: 8,
        foDensity: 980,
        bunkerFlowKgPerH: 4,
      },
      navigation: {
        latDeg: 1.25,
        lonDeg: 103.8,
        speedOverGround: 11.5,
      },
      rpm: 720,
      load: 64,
      shaftPowerKw: 4100,
      shaftTorqueNm: 900,
      foServiceLevelPct: 72,
    };

    const snapshot = buildFmccSnapshot(config, data);

    expect(snapshot.vesselId).toBe("vessel-1");
    expect(snapshot.orgId).toBe("org-1");
    expect(snapshot.source).toBe("fmcc");
    expect(snapshot.fuel.totalFlowKgPerH).toBe(125);
    expect(snapshot.fuel.mainEngineFlowKgPerH).toBe(120);
    expect(snapshot.fuel.generatorFlowKgPerH).toBe(8);
    expect(snapshot.fuel.bunkerFlowKgPerH).toBe(4);
    expect(snapshot.navigation).toMatchObject({ latDeg: 1.25, lonDeg: 103.8 });
    expect(snapshot.engine).toMatchObject({ rpm: 720, loadPercent: 64 });
    expect(snapshot.shaft).toMatchObject({ powerKw: 4100, torqueNm: 900 });
    expect(snapshot.tanks).toMatchObject({ foServiceLevelPct: 72 });
  });
});
