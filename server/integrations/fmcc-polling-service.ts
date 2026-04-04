/**
 * FMCC Polling Service
 * 
 * Continuously polls FMCC for telemetry data and routes it to:
 * 1. Existing TrackLogService for navigation/position data
 * 2. Existing telemetry pipeline for fuel/engine sensor data
 * 
 * DESIGN RULES:
 * - FMCC plugs into existing telemetry & track schema, not a parallel universe
 * - If FMCC is disabled, the system behaves exactly as before (no regressions)
 * - Track log consumers should not care if data came from GPS vs FMCC
 * - Use source: 'fmcc' as the distinguishing attribute
 */

import { EventEmitter } from 'node:events';
import { trackLogService, Position } from '../services/track-log-service';
import { storage } from '../storage';
import { getFMCCService } from './index';
import type { FmccSnapshot, FmccPollingConfig, FmccHealthStatus } from './fmcc-types';

export class FmccPollingService extends EventEmitter {
  private config: FmccPollingConfig;
  private pollingInterval: NodeJS.Timeout | null = null;
  private health: FmccHealthStatus;
  private lastPosition: { lat: number; lon: number; timestamp: Date } | null = null;

  constructor(config: Partial<FmccPollingConfig> = {}) {
    super();
    
    this.config = {
      enabled: process.env.FMCC_ENABLED === 'true',
      vesselId: config.vesselId || process.env.FMCC_VESSEL_ID || 'default-vessel',
      orgId: config.orgId || process.env.FMCC_ORG_ID || 'default-org-id',
      pollIntervalMs: Number.parseInt(process.env.FMCC_POLLING_INTERVAL_MS || '60000', 10),
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
      console.log('[FMCC Polling] Service disabled (FMCC_ENABLED != true)');
    }
  }

  /**
   * Start the polling loop
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('[FMCC Polling] Not starting - FMCC is disabled');
      return;
    }

    if (this.pollingInterval) {
      console.warn('[FMCC Polling] Already running, ignoring start request');
      return;
    }

    console.log(`[FMCC Polling] Starting with interval ${this.config.pollIntervalMs}ms`);
    console.log(`[FMCC Polling] Vessel: ${this.config.vesselId}, Org: ${this.config.orgId}`);
    console.log(`[FMCC Polling] Track logging: ${this.config.enableTrackLogging}`);
    console.log(`[FMCC Polling] Telemetry logging: ${this.config.enableTelemetryLogging}`);

    this.pollingInterval = setInterval(
      () => this.poll().catch(err => this.handlePollError(err)),
      this.config.pollIntervalMs
    );

    this.poll().catch(err => this.handlePollError(err));
  }

  /**
   * Stop the polling loop
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[FMCC Polling] Stopped');
    }
  }

  /**
   * Perform a single poll and route data to appropriate subsystems
   */
  async poll(): Promise<FmccSnapshot | null> {
    if (!this.config.enabled) { return null; }

    const startTime = Date.now();
    const fmccService = getFMCCService();

    if (!fmccService.isReady()) {
      console.log('[FMCC Polling] Service not ready, skipping poll');
      return null;
    }

    try {
      // Use getInstantFuelFlow from the existing FMCC service
      const result = await fmccService.getInstantFuelFlow(this.config.vesselId);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get FMCC data');
      }

      const snapshot = this.buildSnapshot(result.data);
      
      await this.routeToSubsystems(snapshot);

      this.updateHealthSuccess(Date.now() - startTime);
      this.emit('poll_success', snapshot);
      
      return snapshot;

    } catch (error) {
      this.handlePollError(error);
      return null;
    }
  }

  /**
   * Build a normalized FmccSnapshot from raw FMCC data
   */
  private buildSnapshot(data: any): FmccSnapshot {
    const snapshot: FmccSnapshot = {
      vesselId: this.config.vesselId,
      orgId: this.config.orgId,
      timestamp: new Date().toISOString(),
      source: 'fmcc',
      fuel: {},
    };

    const hasFuelData = data.foFlowRate !== undefined || data.foNetFlowKgPerH !== undefined ||
      data.bunkerFlowKgPerH !== undefined || data.doFlowKgPerH !== undefined ||
      data.boilerFlowKgPerH !== undefined || data.foDensity !== undefined;
    if (hasFuelData) {
      snapshot.fuel = {
        totalFlowKgPerH: data.foNetFlowKgPerH ?? data.foFlowRate,
        mainEngineFlowKgPerH: data.foFlowRate,
        generatorFlowKgPerH: data.doFlowRate,
        portEngineFlowKgPerH: data.portEngineFlowKgPerH,
        stbdEngineFlowKgPerH: data.stbdEngineFlowKgPerH,
        boilerFlowKgPerH: data.boilerFlowKgPerH,
        auxEngine1FlowKgPerH: data.auxEngine1FlowKgPerH,
        auxEngine2FlowKgPerH: data.auxEngine2FlowKgPerH,
        foDensity: data.foDensity,
        doDensity: data.doDensity,
        foTemperature: data.foTemperature,
        doTemperature: data.doTemperature,
        foCumulativeKg: data.foCumulativeKg,
        doCumulativeKg: data.doCumulativeKg,
        doFlowKgPerH: data.doFlowKgPerH,
        bunkerFlowKgPerH: data.bunkerFlowKgPerH,
        bunkerCumulativeKg: data.bunkerCumulativeKg,
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

  /**
   * Route snapshot data to appropriate existing subsystems
   * 
   * IMPORTANT: This integrates with EXISTING services, not parallel ones:
   * - Navigation data → TrackLogService (existing vessel_track_log table)
   * - Fuel/Engine data → storage.createTelemetryReading (existing equipmentTelemetry)
   */
  private async routeToSubsystems(snapshot: FmccSnapshot): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.enableTrackLogging && snapshot.navigation?.latDeg !== undefined) {
      promises.push(this.routeToTrackLog(snapshot));
    }

    if (this.config.enableTelemetryLogging) {
      if (snapshot.fuel.totalFlowKgPerH !== undefined) {
        promises.push(this.routeToTelemetry(snapshot, 'fuel'));
      }

      if (snapshot.engine?.rpm !== undefined) {
        promises.push(this.routeToTelemetry(snapshot, 'engine'));
      }

      if (snapshot.tanks) {
        promises.push(this.routeToTelemetry(snapshot, 'tanks'));
      }

      if (snapshot.shaft && (snapshot.shaft.powerKw !== undefined || snapshot.shaft.torqueNm !== undefined || snapshot.shaft.rpmShaft !== undefined)) {
        promises.push(this.routeToTelemetry(snapshot, 'shaft'));
      }

      if (snapshot.fuel.bunkerFlowKgPerH !== undefined) {
        promises.push(this.routeToTelemetry(snapshot, 'bunker'));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Route navigation data to the EXISTING TrackLogService
   * 
   * DESIGN: FMCC position data flows into the same vesselTrackLog table
   * as GPS/AIS data, with source='fmcc' to distinguish origin.
   * The track log is the single source of truth; we do NOT maintain
   * separate FMCC-only tracks.
   */
  private async routeToTrackLog(snapshot: FmccSnapshot): Promise<void> {
    if (!snapshot.navigation?.latDeg || !snapshot.navigation?.lonDeg) { return; }

    const position: Position = {
      latitude: snapshot.navigation.latDeg,
      longitude: snapshot.navigation.lonDeg,
      timestamp: new Date(snapshot.timestamp),
      sog: snapshot.navigation.speedOverGround,
      cog: snapshot.navigation.courseOverGround,
      heading: snapshot.navigation.heading,
      source: 'fmcc',
    };

    if (!this.isValidPosition(position.latitude, position.longitude)) {
      console.warn('[FMCC Polling] Invalid position coordinates, skipping track log');
      return;
    }

    try {
      const logId = await trackLogService.logPosition(
        snapshot.orgId,
        snapshot.vesselId,
        position
      );

      if (logId) {
        console.log(`[FMCC Polling] Track point logged: ${logId} (${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)})`);
        this.lastPosition = {
          lat: position.latitude,
          lon: position.longitude,
          timestamp: position.timestamp,
        };
      }
    } catch (error) {
      console.error('[FMCC Polling] Failed to log track point:', error);
    }
  }

  /**
   * Route fuel/engine telemetry to the EXISTING telemetry pipeline
   */
  private async routeToTelemetry(snapshot: FmccSnapshot, type: 'fuel' | 'engine' | 'tanks' | 'shaft' | 'bunker'): Promise<void> {
    try {
      const timestamp = new Date(snapshot.timestamp);

      if (type === 'fuel' && snapshot.fuel.totalFlowKgPerH !== undefined) {
        await storage.createTelemetryReading({
          equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
          sensorType: 'fuel_consumption',
          value: snapshot.fuel.totalFlowKgPerH,
          timestamp,
          metadata: {
            source: 'fmcc',
            vesselId: snapshot.vesselId,
            foDensity: snapshot.fuel.foDensity,
            foTemperature: snapshot.fuel.foTemperature,
            doDensity: snapshot.fuel.doDensity,
            doTemperature: snapshot.fuel.doTemperature,
            unit: 'kg/h',
          },
        });

        if (snapshot.fuel.foDensity !== undefined) {
          await storage.createTelemetryReading({
            equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
            sensorType: 'fuel_density',
            value: snapshot.fuel.foDensity,
            timestamp,
            metadata: { source: 'fmcc', vesselId: snapshot.vesselId, unit: 'kg/m³' },
          });
        }

        if (snapshot.fuel.foTemperature !== undefined) {
          await storage.createTelemetryReading({
            equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
            sensorType: 'fuel_temperature',
            value: snapshot.fuel.foTemperature,
            timestamp,
            metadata: { source: 'fmcc', vesselId: snapshot.vesselId, unit: '°C' },
          });
        }

        const perEngineFlows: Array<[string, number | undefined]> = [
          ['main_engine_flow', snapshot.fuel.mainEngineFlowKgPerH],
          ['port_engine_flow', snapshot.fuel.portEngineFlowKgPerH],
          ['stbd_engine_flow', snapshot.fuel.stbdEngineFlowKgPerH],
          ['generator_flow', snapshot.fuel.generatorFlowKgPerH],
          ['boiler_flow', snapshot.fuel.boilerFlowKgPerH],
          ['do_flow', snapshot.fuel.doFlowKgPerH],
          ['aux_engine_1_flow', snapshot.fuel.auxEngine1FlowKgPerH],
          ['aux_engine_2_flow', snapshot.fuel.auxEngine2FlowKgPerH],
        ];
        for (const [sensorType, value] of perEngineFlows) {
          if (value !== undefined) {
            await storage.createTelemetryReading({
              equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
              sensorType,
              value,
              timestamp,
              metadata: { source: 'fmcc', vesselId: snapshot.vesselId, unit: 'kg/h' },
            });
          }
        }
      }

      if (type === 'engine' && snapshot.engine) {
        if (snapshot.engine.rpm !== undefined) {
          await storage.createTelemetryReading({
            equipmentId: `fmcc-engine-${snapshot.vesselId}`,
            sensorType: 'rpm',
            value: snapshot.engine.rpm,
            timestamp,
            metadata: { source: 'fmcc', vesselId: snapshot.vesselId, unit: 'rpm' },
          });
        }

        if (snapshot.engine.loadPercent !== undefined) {
          await storage.createTelemetryReading({
            equipmentId: `fmcc-engine-${snapshot.vesselId}`,
            sensorType: 'engine_load',
            value: snapshot.engine.loadPercent,
            timestamp,
            metadata: { source: 'fmcc', vesselId: snapshot.vesselId, unit: '%' },
          });
        }

        if (snapshot.engine.powerKw !== undefined) {
          await storage.createTelemetryReading({
            equipmentId: `fmcc-engine-${snapshot.vesselId}`,
            sensorType: 'power_output',
            value: snapshot.engine.powerKw,
            timestamp,
            metadata: { source: 'fmcc', vesselId: snapshot.vesselId, unit: 'kW' },
          });
        }

        if (snapshot.engine.runningHours !== undefined) {
          await storage.createTelemetryReading({
            equipmentId: `fmcc-engine-${snapshot.vesselId}`,
            sensorType: 'running_hours',
            value: snapshot.engine.runningHours,
            timestamp,
            metadata: { source: 'fmcc', vesselId: snapshot.vesselId, unit: 'hours' },
          });
        }
      }

      if (type === 'tanks' && snapshot.tanks) {
        const tankEntries: Array<[string, number | undefined]> = [
          ['tank_fo_service', snapshot.tanks.foServiceLevelPct],
          ['tank_fo_settling', snapshot.tanks.foSettlingLevelPct],
          ['tank_do_service', snapshot.tanks.doServiceLevelPct],
          ['tank_do_settling', snapshot.tanks.doSettlingLevelPct],
        ];
        for (const [sensorType, value] of tankEntries) {
          if (value !== undefined) {
            await storage.createTelemetryReading({
              equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
              sensorType,
              value,
              timestamp,
              metadata: { source: 'fmcc', vesselId: snapshot.vesselId, unit: '%' },
            });
          }
        }
      }

      if (type === 'shaft' && snapshot.shaft) {
        const shaftEntries: Array<[string, number | undefined, string]> = [
          ['shaft_power', snapshot.shaft.powerKw, 'kW'],
          ['shaft_torque', snapshot.shaft.torqueNm, 'Nm'],
          ['shaft_rpm', snapshot.shaft.rpmShaft, 'RPM'],
          ['shaft_generator', snapshot.shaft.shaftGeneratorKw, 'kW'],
        ];
        for (const [sensorType, value, unit] of shaftEntries) {
          if (value !== undefined) {
            await storage.createTelemetryReading({
              equipmentId: `fmcc-engine-${snapshot.vesselId}`,
              sensorType,
              value,
              timestamp,
              metadata: { source: 'fmcc', vesselId: snapshot.vesselId, unit },
            });
          }
        }
      }

      if (type === 'bunker' && snapshot.fuel.bunkerFlowKgPerH !== undefined) {
        await storage.createTelemetryReading({
          equipmentId: `fmcc-fuel-${snapshot.vesselId}`,
          sensorType: 'bunker_flow',
          value: snapshot.fuel.bunkerFlowKgPerH,
          timestamp,
          metadata: { source: 'fmcc', vesselId: snapshot.vesselId, unit: 'kg/h' },
        });
      }
    } catch (error) {
      console.error(`[FMCC Polling] Failed to store ${type} telemetry:`, error);
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
      console.warn(`[FMCC Polling] Poll failed (attempt ${this.health.consecutiveFailures}):`, message);
    } else if (this.health.consecutiveFailures % 10 === 0) {
      console.error(`[FMCC Polling] ${this.health.consecutiveFailures} consecutive failures:`, message);
    }

    this.emit('poll_error', { error: message, consecutiveFailures: this.health.consecutiveFailures });
  }

  private updateHealthSuccess(responseTimeMs: number): void {
    this.health.connected = true;
    this.health.lastSuccessfulPoll = new Date();
    this.health.consecutiveFailures = 0;
    this.health.totalPollsSuccess++;

    const totalPolls = this.health.totalPollsSuccess;
    this.health.averageResponseTimeMs = 
      ((this.health.averageResponseTimeMs * (totalPolls - 1)) + responseTimeMs) / totalPolls;
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

  service.on('poll_success', async (snapshot: FmccSnapshot) => {
    try {
      const { bunkeringDetector } = await import('../services/rms/bunkering-detector');
      const { rmsAlertService } = await import('../services/rms/alert-service');
      const results = await Promise.allSettled([
        bunkeringDetector.processSnapshot(snapshot),
        rmsAlertService.processSnapshot(snapshot),
      ]);
      for (const r of results) {
        if (r.status === 'rejected') {
          console.error('[FMCC→RMS] Processor error:', r.reason);
        }
      }
    } catch (err) {
      console.error('[FMCC→RMS] Integration error:', err);
    }
  });

  if (service.getConfig().enabled && !service.isRunning()) {
    service.start();
  }
}
