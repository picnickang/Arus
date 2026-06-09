import { jest } from "@jest/globals";

const executeMock = jest.fn();
const emitMock = jest.fn();

jest.unstable_mockModule("../../server/db", () => ({
  db: {
    execute: executeMock,
  },
}));

jest.unstable_mockModule("../../server/lib/domain-event-bus", () => ({
  domainEventBus: {
    emit: emitMock,
  },
}));

const { rmsAlertService } = await import("../../server/services/rms/alert-service");

type AlertRow = {
  id: string;
  alert_type: string;
  config: Record<string, unknown>;
  cooldown_minutes?: number;
  last_triggered_at?: Date | null;
  notify_email?: boolean;
  notify_in_app?: boolean;
  name?: string;
};

const alertRow = (overrides: AlertRow): Record<string, unknown> => ({
  vessel_id: "vessel-a",
  org_id: "org-a",
  name: "Alert",
  cooldown_minutes: 0,
  last_triggered_at: null,
  notify_email: false,
  notify_in_app: false,
  ...overrides,
});

const rows = (value: Record<string, unknown>[]) => ({ rows: value });

const snapshot = (overrides: Record<string, unknown> = {}) =>
  ({
    orgId: "org-a",
    vesselId: "vessel-a",
    timestamp: new Date("2026-06-01T12:00:00Z"),
    fuel: {
      mainEngineFlowKgPerH: 140,
      generatorFlowKgPerH: 20,
      totalFlowKgPerH: 160,
      bunkerFlowKgPerH: 0,
      foDensity: 850,
    },
    navigation: {
      latDeg: 1,
      lonDeg: 1,
    },
    ...overrides,
  }) as never;

describe("rmsAlertService", () => {
  beforeEach(() => {
    rmsAlertService.clearCache();
    executeMock.mockReset();
    emitMock.mockReset();
  });

  it("triggers fuel threshold alerts and emits tenant-scoped domain events", async () => {
    executeMock
      .mockResolvedValueOnce(
        rows([
          alertRow({
            id: "cfg-fuel",
            alert_type: "fuel_threshold",
            name: "Main engine high fuel",
            config: {
              engineKey: "mainEngine",
              thresholdKgPerH: 100,
              direction: "above",
            },
          }),
        ])
      )
      .mockResolvedValueOnce(rows([{ id: "alert-fuel" }]))
      .mockResolvedValueOnce(rows([]));

    await rmsAlertService.processSnapshot(snapshot());

    expect(executeMock).toHaveBeenCalledTimes(3);
    expect(emitMock).toHaveBeenCalledWith(
      "rms.alert_triggered",
      expect.objectContaining({
        orgId: "org-a",
        eventType: "rms.alert_triggered",
        payload: expect.objectContaining({
          alertLogId: "alert-fuel",
          vesselId: "vessel-a",
          alertType: "fuel_threshold",
          severity: "warning",
        }),
      })
    );
  });

  it("honors cooldowns before triggering repeated alerts", async () => {
    executeMock.mockResolvedValueOnce(
      rows([
        alertRow({
          id: "cfg-cooldown",
          alert_type: "fuel_threshold",
          cooldown_minutes: 30,
          last_triggered_at: new Date(),
          config: {
            engineKey: "mainEngine",
            thresholdKgPerH: 100,
            direction: "above",
          },
        }),
      ])
    );

    await rmsAlertService.processSnapshot(snapshot());

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("triggers geofence alerts only after an enter or exit transition", async () => {
    executeMock.mockResolvedValueOnce(
      rows([
        alertRow({
          id: "cfg-geofence",
          alert_type: "geofence",
          name: "Harbor zone",
          config: {
            centerLat: 1,
            centerLon: 1,
            radiusNm: 1,
            triggerOn: "exit",
          },
        }),
      ])
    );

    await rmsAlertService.processSnapshot(snapshot());
    expect(emitMock).not.toHaveBeenCalled();

    executeMock
      .mockResolvedValueOnce(rows([{ id: "alert-geofence" }]))
      .mockResolvedValueOnce(rows([]));
    await rmsAlertService.processSnapshot(
      snapshot({
        navigation: {
          latDeg: 5,
          lonDeg: 5,
        },
      })
    );

    expect(emitMock).toHaveBeenCalledWith(
      "rms.alert_triggered",
      expect.objectContaining({
        payload: expect.objectContaining({
          alertLogId: "alert-geofence",
          alertType: "geofence",
          severity: "info",
        }),
      })
    );
  });

  it("projects daily consumption from available telemetry hours before triggering", async () => {
    executeMock
      .mockResolvedValueOnce(
        rows([
          alertRow({
            id: "cfg-daily",
            alert_type: "daily_consumption",
            name: "Daily fuel limit",
            config: { maxDailyMt: 20 },
          }),
        ])
      )
      .mockResolvedValueOnce(rows([{ hours_with_data: 4, avg_flow_kg_per_h: 1000 }]))
      .mockResolvedValueOnce(rows([{ id: "alert-daily" }]))
      .mockResolvedValueOnce(rows([]));

    await rmsAlertService.processSnapshot(snapshot());

    expect(executeMock).toHaveBeenCalledTimes(4);
    expect(emitMock).toHaveBeenCalledWith(
      "rms.alert_triggered",
      expect.objectContaining({
        payload: expect.objectContaining({
          alertLogId: "alert-daily",
          alertType: "daily_consumption",
          severity: "warning",
        }),
      })
    );
  });

  it("detects bunkering start transitions without alerting on the initial state sample", async () => {
    executeMock.mockResolvedValueOnce(
      rows([
        alertRow({
          id: "cfg-bunker",
          alert_type: "bunkering",
          name: "Bunkering watch",
          config: {
            notifyOnStart: true,
            notifyOnEnd: true,
          },
        }),
      ])
    );

    await rmsAlertService.processSnapshot(snapshot());
    expect(emitMock).not.toHaveBeenCalled();

    executeMock
      .mockResolvedValueOnce(rows([{ id: "alert-bunker" }]))
      .mockResolvedValueOnce(rows([]));
    await rmsAlertService.processSnapshot(
      snapshot({
        fuel: {
          mainEngineFlowKgPerH: 140,
          generatorFlowKgPerH: 20,
          totalFlowKgPerH: 160,
          bunkerFlowKgPerH: 600,
          foDensity: 850,
        },
      })
    );

    expect(emitMock).toHaveBeenCalledWith(
      "rms.alert_triggered",
      expect.objectContaining({
        payload: expect.objectContaining({
          alertLogId: "alert-bunker",
          alertType: "bunkering",
          severity: "info",
        }),
      })
    );
  });

  it("fails closed when alert config loading errors", async () => {
    executeMock.mockRejectedValueOnce(new Error("db offline"));

    await expect(rmsAlertService.processSnapshot(snapshot())).resolves.toBeUndefined();

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(emitMock).not.toHaveBeenCalled();
  });
});
