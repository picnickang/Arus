import { EventEmitter } from "node:events";
import { trackLogService, Position } from "../services/track-log-service";
import { dbTelemetryStorage } from "../repositories";
import { getFMCCService } from "./index";
import type { FmccSnapshot, FmccPollingConfig, FmccHealthStatus } from "./fmcc-types";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Integrations:FmccPollingService");

export class FmccPollingService extends EventEmitter {
  private config: FmccPollingConfig;
  private pollingInterval: NodeJS.Timeout | null = null;
  private health: FmccHealthStatus;
  private lastPosition: { lat: number; lon: number; timestamp: Date } | null = null;

  constructor(config: Partial<FmccPollingConfig> = {}) {
    super();

    this.config = {
      enabled: process.env.FMCC_ENABLED === "true",
      vesselId: config.vesselId || process.env.FMCC_VESSEL_ID || "default-vessel",
      orgId: config.orgId || process.env.FMCC_ORG_ID || "default-org-id",
      pollIntervalMs: Number.parseInt(process.env.FMCC_POLLING_INTERVAL_MS || "60000", 10),
      enableTrackLogging: config.enableTrackLogging ?? true,
      enableTelemetryLogging: config.enableTelemetryLogging ?? true,
      minPositionChangeNm: config.minPositionChangeNm ?? 0.05,
      maxTrackGapMinutes: config.maxTrackGapMinutes ?? 5,
    };

    this.health = {
      enabled: this.config.enabled,
      connected: false,
      lastSuccessfulPoll: null,
      lastError: null,
      lastErrorTime: null,
      consecutiveFailures: 0,
      totalPollsSuccess: 0,
      totalPollsFailed: 0,
      averageResponseTimeMs: 0,
    };

    if (!this.config.enabled) {
      logger.info("[FMCC Polling] Service disabled (FMCC_ENABLED != true)");
    }
  }

  start(): void {
    if (!this.config.enabled) {
      logger.info("[FMCC Polling] Not starting - FMCC is disabled");
      return;
    }

    if (this.pollingInterval) {
      logger.warn("[FMCC Polling] Already running, ignoring start request");
      return;
    }

    logger.info(`[FMCC Polling] Starting with interval ${this.config.pollIntervalMs}ms`);
    logger.info(`[FMCC Polling] Vessel: ${this.config.vesselId}, Org: ${this.config.orgId}`);
    logger.info(`[FMCC Polling] Track logging: ${this.config.enableTrackLogging}`);
    logger.info(`[FMCC Polling] Telemetry logging: ${this.config.enableTelemetryLogging}`);

    this.pollingInterval = setInterval(
      () => this.poll().catch((err) => this.handlePollError(err)),
      this.config.pollIntervalMs
    );

    this.poll().catch((err) => this.handlePollError(err));
  }

  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.info("[FMCC Polling] Stopped");
    }
  }

  async poll(): Promise<FmccSnapshot | null> {
    if (!this.config.enabled) {
      return null;
    }

    const startTime = Date.now();
    const fmccService = getFMCCService();

    if (!fmccService.isReady()) {
      logger.info("[FMCC Polling] Service not ready, skipping poll");
      return null;
    }

    try {
      const result = await fmccService.getInstantFuelFlow(this.config.vesselId);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to get FMCC data");
      }

      const snapshot = this.buildSnapshot(result.data);

      await this.routeToSubsystems(snapshot);

      this.updateHealthSuccess(Date.now() - startTime);
      this.emit("poll_success", snapshot);

      return snapshot;
    } catch (error) {
      this.handlePollError(error);
      return null;
    }
  }

  private buildSnapshot(data: any): FmccSnapshot {
    const snapshot: FmccSnapshot = {
      vesselId: this.config.vesselId,
      orgId: this.config.orgId,
      timestamp: new Date().toISOString(),
      source: "fmcc",
      fuel: {},
    };

    const fuelData = data.fuel ?? data;
    const hasFuelData =
      fuelData.foFlowKgPerH !== undefined ||
      fuelData.foNetFlowKgPerH !== undefined ||
      fuelData.totalFlowKgPerH !== undefined ||
      fuelData.mainEngineFlowKgPerH !== undefined ||
      fuelData.bunkerFlowKgPerH !== undefined ||
      fuelData.doFlowKgPerH !== undefined ||
      fuelData.boilerFlowKgPerH !== undefined ||
      fuelData.foDensity !== undefined;
    if (hasFuelData) {
      snapshot.fuel = {
        totalFlowKgPerH:
          fuelData.totalFlowKgPerH ?? fuelData.foNetFlowKgPerH ?? fuelData.foFlowKgPerH,
        mainEngineFlowKgPerH: fuelData.mainEngineFlowKgPerH ?? fuelData.foFlowKgPerH,
        generatorFlowKgPerH: fuelData.generatorFlowKgPerH ?? fuelData.doFlowKgPerH,
        portEngineFlowKgPerH: fuelData.portEngineFlowKgPerH,
        stbdEngineFlowKgPerH: fuelData.stbdEngineFlowKgPerH,
        boilerFlowKgPerH: fuelData.boilerFlowKgPerH,
        auxEngine1FlowKgPerH: fuelData.auxEngine1FlowKgPerH,
        auxEngine2FlowKgPerH: fuelData.auxEngine2FlowKgPerH,
        foDensity: fuelData.foDensity,
        doDensity: fuelData.doDensity,
        foTemperature: fuelData.foTemperature,
        doTemperature: fuelData.doTemperature,
        foCumulativeKg: fuelData.foCumulativeKg,
        doCumulativeKg: fuelData.doCumulativeKg,
        doFlowKgPerH: fuelData.doFlowKgPerH,
        bunkerFlowKgPerH: fuelData.bunkerFlowKgPerH,
        bunkerCumulativeKg: fuelData.bunkerCumulativeKg,
      };
    }

    if (data.navigation || data.latitude !== undefined) {
      snapshot.navigation = {
        latDeg: data.navigation?.latDeg ?? data.latitude,
        lonDeg: data.navigation?.lonDeg ?? data.longitude,
        speedOverGround: data.navigation?.speedOverGround ?? data.sog,
        courseOverGround: data.navigation?.courseOverGround ?? data.cog,
        heading: data.navigation?.heading ?? data.heading,
      };
    }

    if (data.engine || data.rpm !== undefined) {
      snapshot.engine = {
        rpm: data.engine?.rpm ?? data.rpm,
        loadPercent: data.engine?.loadPercent ?? data.load,
        runningHours: data.engine?.runningHours,
        powerKw: data.engine?.powerKw,
      };
    }

    if (data.shaft || data.shaftPowerKw !== undefined) {
      snapshot.shaft = {
        powerKw: data.shaft?.powerKw ?? data.shaftPowerKw,
        torqueNm: data.shaft?.torqueNm ?? data.shaftTorqueNm,
        rpmShaft: data.shaft?.rpmShaft ?? data.shaftRpm,
        shaftGeneratorKw: data.shaft?.shaftGeneratorKw ?? data.shaftGeneratorKw,
      };
    }

    if (data.tanks || data.foServiceLevelPct !== undefined) {
      snapshot.tanks = {
        foServiceLevelPct: data.tanks?.foServiceLevelPct ?? data.foServiceLevelPct,
        foSettlingLevelPct: data.tanks?.foSettlingLevelPct ?? data.foSettlingLevelPct,
        doServiceLevelPct: data.tanks?.doServiceLevelPct ?? data.doServiceLevelPct,
        doSettlingLevelPct: data.tanks?.doSettlingLevelPct ?? data.doSettlingLevelPct,
        foServiceVolumeM3: data.tanks?.foServiceVolumeM3 ?? data.foServiceVolumeM3,
        foSettlingVolumeM3: data.tanks?.foSettlingVolumeM3 ?? data.foSettlingVolumeM3,
        doServiceVolumeM3: data.tanks?.doServiceVolumeM3 ?? data.doServiceVolumeM3,
        doSettlingVolumeM3: data.tanks?.doSettlingVolumeM3 ?? data.doSettlingVolumeM3,
      };
    }

    return snapshot;
  }

  private async routeToSubsystems(snapshot: FmccSnapshot): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.enableTrackLogging && snapshot.navigation?.latDeg !== undefined) {
      promises.push(this.routeToTrackLog(snapshot));
    }

    if (this.config.enableTelemetryLogging) {
      const hasFuel = snapshot.fuel && Object.values(snapshot.fuel).some((v) => v !== undefined);
      if (hasFuel) {
        promises.push(this.routeToTelemetry(snapshot, "fuel"));
      }

      const hasEngine =
        snapshot.engine && Object.values(snapshot.engine).some((v) => v !== undefined);
      if (hasEngine) {
        promises.push(this.routeToTelemetry(snapshot, "engine"));
      }

      if (snapshot.tanks) {
        promises.push(this.routeToTelemetry(snapshot, "tanks"));
      }

      if (
        snapshot.shaft &&
        (snapshot.shaft.powerKw !== undefined ||
          snapshot.shaft.torqueNm !== undefined ||
          snapshot.shaft.rpmShaft !== undefined)
      ) {
        promises.push(this.routeToTelemetry(snapshot, "shaft"));
      }

      if (snapshot.fuel.bunkerFlowKgPerH !== undefined) {
        promises.push(this.routeToTelemetry(snapshot, "bunker"));
      }
    }

    await Promise.all(promises);
  }

  private async routeToTrackLog(snapshot: FmccSnapshot): Promise<void> {
    if (!snapshot.navigation?.latDeg || !snapshot.navigation?.lonDeg) {
      return;
    }

    const position: Position = {
      latitude: snapshot.navigation.latDeg,
      longitude: snapshot.navigation.lonDeg,
      timestamp: new Date(snapshot.timestamp),
      sog: snapshot.navigation.speedOverGround,
      cog: snapshot.navigation.courseOverGround,
      heading: snapshot.navigation.heading,
      source: "fmcc",
    };

    if (!this.isValidPosition(position.latitude, position.longitude)) {
      logger.warn("[FMCC Polling] Invalid position coordinates, skipping track log");
      return;
    }

    try {
      const logId = await trackLogService.logPosition(snapshot.orgId, snapshot.vesselId, position);

      if (logId) {
        logger.info(`[FMCC Polling] Track point logged: ${logId} (${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)})`);
        this.lastPosition = {
          lat: position.latitude,
          lon: position.longitude,
          timestamp: position.timestamp,
        };
      }
    } catch (error) {
      logger.error("[FMCC Polling] Failed to log track point:", undefined, error);
    }
  }

  private async routeToTelemetry(
    snapshot: FmccSnapshot,
    type: "fuel" | "engine" | "tanks" | "shaft" | "bunker"
  ): Promise<void> {
    try {
      const timestamp = new Date(snapshot.timestamp);

      if (type === "fuel") {
        if (snapshot.fuel.totalFlowKgPerH !== undefined) {
          await dbTelemetryStorage.createTelemetryReading({
            orgId: snapshot.orgId,
            equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
            sensorType: "fuel_consumption",
            value: snapshot.fuel.totalFlowKgPerH,
            ts: timestamp,
            unit: "kg/h",
          });
        }

        if (snapshot.fuel.foDensity !== undefined) {
          await dbTelemetryStorage.createTelemetryReading({
            orgId: snapshot.orgId,
            equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
            sensorType: "fuel_density",
            value: snapshot.fuel.foDensity,
            ts: timestamp,
            unit: "kg/m³",
          });
        }

        if (snapshot.fuel.foTemperature !== undefined) {
          await dbTelemetryStorage.createTelemetryReading({
            orgId: snapshot.orgId,
            equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
            sensorType: "fuel_temperature",
            value: snapshot.fuel.foTemperature,
            ts: timestamp,
            unit: "°C",
          });
        }

        const perEngineFlows: Array<[string, number | undefined]> = [
          ["main_engine_flow", snapshot.fuel.mainEngineFlowKgPerH],
          ["port_engine_flow", snapshot.fuel.portEngineFlowKgPerH],
          ["stbd_engine_flow", snapshot.fuel.stbdEngineFlowKgPerH],
          ["generator_flow", snapshot.fuel.generatorFlowKgPerH],
          ["boiler_flow", snapshot.fuel.boilerFlowKgPerH],
          ["do_flow", snapshot.fuel.doFlowKgPerH],
          ["aux_engine_1_flow", snapshot.fuel.auxEngine1FlowKgPerH],
          ["aux_engine_2_flow", snapshot.fuel.auxEngine2FlowKgPerH],
        ];
        for (const [sensorType, value] of perEngineFlows) {
          if (value !== undefined) {
            await dbTelemetryStorage.createTelemetryReading({
              orgId: snapshot.orgId,
              equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
              sensorType,
              value,
              ts: timestamp,
              unit: "kg/h",
            });
          }
        }
      }

      if (type === "engine" && snapshot.engine) {
        if (snapshot.engine.rpm !== undefined) {
          await dbTelemetryStorage.createTelemetryReading({
            orgId: snapshot.orgId,
            equipmentId: `fmcc-engine-${snapshot.vesselId}`,
            sensorType: "rpm",
            value: snapshot.engine.rpm,
            ts: timestamp,
            unit: "rpm",
          });
        }
        if (snapshot.engine.loadPercent !== undefined) {
          await dbTelemetryStorage.createTelemetryReading({
            orgId: snapshot.orgId,
            equipmentId: `fmcc-engine-${snapshot.vesselId}`,
            sensorType: "engine_load",
            value: snapshot.engine.loadPercent,
            ts: timestamp,
            unit: "%",
          });
        }

        if (snapshot.engine.powerKw !== undefined) {
          await dbTelemetryStorage.createTelemetryReading({
            orgId: snapshot.orgId,
            equipmentId: `fmcc-engine-${snapshot.vesselId}`,
            sensorType: "power_output",
            value: snapshot.engine.powerKw,
            ts: timestamp,
            unit: "kW",
          });
        }

        if (snapshot.engine.runningHours !== undefined) {
          await dbTelemetryStorage.createTelemetryReading({
            orgId: snapshot.orgId,
            equipmentId: `fmcc-engine-${snapshot.vesselId}`,
            sensorType: "running_hours",
            value: snapshot.engine.runningHours,
            ts: timestamp,
            unit: "hours",
          });
        }
      }

      if (type === "tanks" && snapshot.tanks) {
        const tankEntries: Array<[string, number | undefined]> = [
          ["tank_fo_service", snapshot.tanks.foServiceLevelPct],
          ["tank_fo_settling", snapshot.tanks.foSettlingLevelPct],
          ["tank_do_service", snapshot.tanks.doServiceLevelPct],
          ["tank_do_settling", snapshot.tanks.doSettlingLevelPct],
        ];
        for (const [sensorType, value] of tankEntries) {
          if (value !== undefined) {
            await dbTelemetryStorage.createTelemetryReading({
              orgId: snapshot.orgId,
              equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
              sensorType,
              value,
              ts: timestamp,
              unit: "%",
            });
          }
        }
      }

      if (type === "shaft" && snapshot.shaft) {
        const shaftEntries: Array<[string, number | undefined, string]> = [
          ["shaft_power", snapshot.shaft.powerKw, "kW"],
          ["shaft_torque", snapshot.shaft.torqueNm, "Nm"],
          ["shaft_rpm", snapshot.shaft.rpmShaft, "RPM"],
          ["shaft_generator", snapshot.shaft.shaftGeneratorKw, "kW"],
        ];
        for (const [sensorType, value, unit] of shaftEntries) {
          if (value !== undefined) {
            await dbTelemetryStorage.createTelemetryReading({
              orgId: snapshot.orgId,
              equipmentId: `fmcc-engine-${snapshot.vesselId}`,
              sensorType,
              value,
              ts: timestamp,
              unit,
            });
          }
        }
      }

      if (type === "bunker" && snapshot.fuel.bunkerFlowKgPerH !== undefined) {
        await dbTelemetryStorage.createTelemetryReading({
          orgId: snapshot.orgId,
          equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
          sensorType: "bunker_flow",
          value: snapshot.fuel.bunkerFlowKgPerH,
          ts: timestamp,
          unit: "kg/h",
        });
      }
    } catch (error) {
      logger.error(`[FMCC Polling] Failed to store ${type} telemetry:`, undefined, error);
    }
  }

  private isValidPosition(lat: number, lon: number): boolean {
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  private handlePollError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.health.lastError = message;
    this.health.lastErrorTime = new Date();
    this.health.consecutiveFailures++;
    this.health.totalPollsFailed++;
    this.health.connected = false;

    if (this.health.consecutiveFailures <= 3) {
      logger.warn(`[FMCC Polling] Poll failed (attempt ${this.health.consecutiveFailures}):`, { details: message });
    } else if (this.health.consecutiveFailures % 10 === 0) {
      logger.error(`[FMCC Polling] ${this.health.consecutiveFailures} consecutive failures:`, undefined, message);
    }

    this.emit("poll_error", {
      error: message,
      consecutiveFailures: this.health.consecutiveFailures,
    });
  }

  private updateHealthSuccess(responseTimeMs: number): void {
    this.health.connected = true;
    this.health.lastSuccessfulPoll = new Date();
    this.health.consecutiveFailures = 0;
    this.health.totalPollsSuccess++;

    const totalPolls = this.health.totalPollsSuccess;
    this.health.averageResponseTimeMs =
      (this.health.averageResponseTimeMs * (totalPolls - 1) + responseTimeMs) / totalPolls;
  }

  getHealth(): FmccHealthStatus {
    return { ...this.health };
  }

  getConfig(): FmccPollingConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.pollingInterval !== null;
  }
}

let pollingServiceInstance: FmccPollingService | null = null;

export function getFmccPollingService(): FmccPollingService {
  if (!pollingServiceInstance) {
    pollingServiceInstance = new FmccPollingService();
  }
  return pollingServiceInstance;
}

export function initializeFmccPolling(): void {
  const service = getFmccPollingService();

  service.on("poll_success", async (snapshot: FmccSnapshot) => {
    try {
      const { bunkeringDetector } = await import("../services/rms/bunkering-detector");
      const { rmsAlertService } = await import("../services/rms/alert-service");
      const results = await Promise.allSettled([
        bunkeringDetector.processSnapshot(snapshot),
        rmsAlertService.processSnapshot(snapshot),
      ]);
      for (const r of results) {
        if (r.status === "rejected") {
          logger.error("[FMCC→RMS] Processor error:", undefined, r.reason);
        }
      }
    } catch (err) {
      logger.error("[FMCC→RMS] Integration error:", undefined, err);
    }
  });

  if (service.getConfig().enabled && !service.isRunning()) {
    service.start();
  }
}
