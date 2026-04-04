import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../utils/logger";
import { domainEventBus } from "../../lib/domain-event-bus";
import { createDomainEvent } from "../../lib/domain-event-bus/types";
import type { FmccSnapshot } from "../../integrations/fmcc-types";

const MODULE = "RmsAlertService";

interface AlertConfig {
  id: string;
  vesselId: string;
  orgId: string;
  alertType: string;
  name: string;
  config: any;
  cooldownMinutes: number;
  lastTriggeredAt: Date | null;
  notifyEmail: boolean;
  notifyInApp: boolean;
}

function getRows(result: any): any[] {
  return Array.isArray(result) ? result : (result as any)?.rows || [];
}

function getFirstRow(result: any): any | undefined {
  return getRows(result)[0];
}

class RmsAlertService {
  private configCache = new Map<string, { configs: AlertConfig[]; loadedAt: number }>();
  private readonly CACHE_TTL_MS = 60_000;
  private geofenceState = new Map<string, boolean>();

  async processSnapshot(snapshot: FmccSnapshot): Promise<void> {
    const configs = await this.getVesselAlertConfigs(snapshot.orgId, snapshot.vesselId);
    if (configs.length === 0) return;

    for (const config of configs) {
      try {
        switch (config.alertType) {
          case 'fuel_threshold':
            await this.checkFuelThreshold(snapshot, config);
            break;
          case 'daily_consumption':
            await this.checkDailyConsumption(snapshot, config);
            break;
          case 'geofence':
            await this.checkGeofence(snapshot, config);
            break;
          case 'bunkering':
            await this.checkBunkering(snapshot, config);
            break;
        }
      } catch (err) {
        logger.error(MODULE, "Alert check failed", { configId: config.id, error: err });
      }
    }
  }

  private async checkFuelThreshold(snapshot: FmccSnapshot, config: AlertConfig): Promise<void> {
    const { engineKey, thresholdKgPerH, direction } = config.config;
    if (!engineKey || thresholdKgPerH === undefined) return;

    const flowMap: Record<string, number | undefined> = {
      mainEngine: snapshot.fuel.mainEngineFlowKgPerH,
      generator: snapshot.fuel.generatorFlowKgPerH,
      portEngine: snapshot.fuel.portEngineFlowKgPerH,
      stbdEngine: snapshot.fuel.stbdEngineFlowKgPerH,
      boiler: snapshot.fuel.boilerFlowKgPerH,
      total: snapshot.fuel.totalFlowKgPerH,
    };

    const currentFlow = flowMap[engineKey];
    if (currentFlow === undefined) return;

    const triggered = direction === 'below'
      ? currentFlow < thresholdKgPerH
      : currentFlow > thresholdKgPerH;

    if (triggered && this.canTrigger(config)) {
      await this.triggerAlert(config, 'warning',
        `Fuel Threshold: ${config.name}`,
        `${engineKey} flow ${currentFlow.toFixed(1)} kg/h ${direction === 'below' ? 'below' : 'above'} threshold ${thresholdKgPerH} kg/h`,
        { engineKey, currentFlow, thresholdKgPerH, direction }
      );
    }
  }

  private async checkDailyConsumption(snapshot: FmccSnapshot, config: AlertConfig): Promise<void> {
    const { maxDailyMt } = config.config;
    if (!maxDailyMt) return;

    const totalFlowKgPerH = snapshot.fuel.totalFlowKgPerH ?? 0;
    const projectedDailyMt = (totalFlowKgPerH * 24) / 1000;

    if (projectedDailyMt > maxDailyMt && this.canTrigger(config)) {
      await this.triggerAlert(config, 'warning',
        `Daily Consumption Projected: ${config.name}`,
        `Current flow rate ${totalFlowKgPerH.toFixed(1)} kg/h projects to ${projectedDailyMt.toFixed(2)} MT/day, exceeding limit of ${maxDailyMt} MT/day`,
        { currentFlowKgPerH: totalFlowKgPerH, projectedDailyMt, maxDailyMt }
      );
    }
  }

  private async checkGeofence(snapshot: FmccSnapshot, config: AlertConfig): Promise<void> {
    const { centerLat, centerLon, radiusNm, polygon, triggerOn } = config.config;
    if (snapshot.navigation?.latDeg == null || snapshot.navigation?.lonDeg == null) return;

    const vesselLat = snapshot.navigation.latDeg;
    const vesselLon = snapshot.navigation.lonDeg;
    let inside: boolean;
    let detail: string;

    if (polygon && Array.isArray(polygon) && polygon.length >= 3) {
      inside = this.pointInPolygon(vesselLat, vesselLon, polygon);
      detail = `polygon (${polygon.length} vertices)`;
    } else if (centerLat != null && centerLon != null && radiusNm != null) {
      const distNm = this.haversineNm(vesselLat, vesselLon, centerLat, centerLon);
      inside = distNm <= radiusNm;
      detail = `distance: ${distNm.toFixed(1)} NM, radius: ${radiusNm} NM`;
    } else {
      return;
    }

    const stateKey = `${config.id}:${snapshot.vesselId}`;
    const wasInside = this.geofenceState.get(stateKey);
    const crossed = wasInside !== undefined && wasInside !== inside;
    this.geofenceState.set(stateKey, inside);

    if (!crossed) return;

    const shouldTrigger = (triggerOn === 'enter' && inside) ||
      (triggerOn === 'exit' && !inside) ||
      (triggerOn === 'both');

    if (shouldTrigger && this.canTrigger(config)) {
      await this.triggerAlert(config, 'info',
        `Geofence ${inside ? 'Entry' : 'Exit'}: ${config.name}`,
        `Vessel ${inside ? 'entered' : 'exited'} geofence zone "${config.name}" (${detail})`,
        { lat: vesselLat, lon: vesselLon, inside }
      );
    }
  }

  private bunkerAccumulators = new Map<string, { startTime: Date; accumulatedKg: number; lastPollTime: Date }>();

  private async checkBunkering(snapshot: FmccSnapshot, config: AlertConfig): Promise<void> {
    const bunkerFlow = snapshot.fuel.bunkerFlowKgPerH;
    if (bunkerFlow === undefined) return;

    const { notifyOnStart, notifyOnEnd, minVolumeLitres } = config.config;
    const minVolumeL = typeof minVolumeLitres === 'number' ? minVolumeLitres : 0;
    const BUNKERING_THRESHOLD = 500;
    const stateKey = `bunker:${config.id}:${snapshot.vesselId}`;
    const wasBunkering = this.geofenceState.get(stateKey);
    const isBunkering = bunkerFlow > BUNKERING_THRESHOLD;

    this.geofenceState.set(stateKey, isBunkering);

    if (isBunkering) {
      const now = new Date();
      const acc = this.bunkerAccumulators.get(stateKey);
      if (acc) {
        const elapsedHours = (now.getTime() - acc.lastPollTime.getTime()) / 3600000;
        acc.accumulatedKg += bunkerFlow * elapsedHours;
        acc.lastPollTime = now;
      } else {
        this.bunkerAccumulators.set(stateKey, { startTime: now, accumulatedKg: 0, lastPollTime: now });
      }
    }

    if (wasBunkering === undefined) return;

    if (!wasBunkering && isBunkering && notifyOnStart && this.canTrigger(config)) {
      this.bunkerAccumulators.set(stateKey, { startTime: new Date(), accumulatedKg: 0, lastPollTime: new Date() });
      await this.triggerAlert(config, 'info',
        `Bunkering Detected: ${config.name}`,
        `Bunkering operation detected. Flow rate: ${bunkerFlow.toFixed(1)} kg/h`,
        { flowKgPerH: bunkerFlow }
      );
    }

    if (wasBunkering && !isBunkering && notifyOnEnd && this.canTrigger(config)) {
      const acc = this.bunkerAccumulators.get(stateKey);
      const accumulatedKg = acc?.accumulatedKg ?? 0;
      const density = snapshot.fuel.foDensity ?? 0.85;
      const estimatedLitres = accumulatedKg / density;

      this.bunkerAccumulators.delete(stateKey);

      if (minVolumeL > 0 && estimatedLitres < minVolumeL) {
        logger.info(MODULE, "Bunkering end suppressed below minVolumeLitres", {
          configId: config.id, estimatedLitres, minVolumeL,
        });
        return;
      }

      await this.triggerAlert(config, 'info',
        `Bunkering Ended: ${config.name}`,
        `Bunkering operation ended. Estimated volume: ${estimatedLitres.toFixed(0)} L (${(accumulatedKg / 1000).toFixed(2)} MT). Min volume filter: ${minVolumeL} L`,
        { flowKgPerH: bunkerFlow, estimatedLitres, accumulatedKg, minVolumeLitres: minVolumeL }
      );
    }
  }

  private haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3440.065;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private pointInPolygon(lat: number, lon: number, polygon: Array<{ lat: number; lon: number }>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lon;
      const xj = polygon[j].lat, yj = polygon[j].lon;
      const intersect = ((yi > lon) !== (yj > lon)) &&
        (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private canTrigger(config: AlertConfig): boolean {
    if (!config.lastTriggeredAt) return true;
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    return Date.now() - new Date(config.lastTriggeredAt).getTime() > cooldownMs;
  }

  private async triggerAlert(
    config: AlertConfig, severity: string,
    title: string, message: string, data: Record<string, any>
  ): Promise<void> {
    try {
      const result = await db.execute(sql`
        INSERT INTO rms_alert_log (org_id, vessel_id, alert_config_id, alert_type, severity, title, message, data)
        VALUES (${config.orgId}, ${config.vesselId}, ${config.id}, ${config.alertType}, ${severity}, ${title}, ${message}, ${JSON.stringify(data)})
        RETURNING id
      `);

      await db.execute(sql`
        UPDATE rms_alert_configs SET last_triggered_at = NOW(), updated_at = NOW()
        WHERE id = ${config.id}
      `);

      config.lastTriggeredAt = new Date();

      const row = getFirstRow(result);
      const alertLogId = row?.id || 'unknown';

      domainEventBus.emit("rms.alert_triggered", createDomainEvent(
        "rms.alert_triggered", config.orgId,
        { alertLogId, configId: config.id, vesselId: config.vesselId, alertType: config.alertType, severity, title, message },
        { aggregateId: alertLogId, aggregateType: "rms_alert" }
      ));

      if (config.notifyInApp) {
        await this.createInAppNotification(config, severity, title, message);
      }

      if (config.notifyEmail) {
        await this.queueEmailNotification(config, severity, title, message);
      }

      logger.info(MODULE, "Alert triggered", { configId: config.id, title, severity });
    } catch (err) {
      logger.error(MODULE, "Failed to trigger alert", { error: err });
    }
  }

  private async createInAppNotification(
    config: AlertConfig, severity: string, title: string, message: string
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO notification_queue (
          org_id, notification_type, subject, body, recipients, related_entity_type, status
        ) VALUES (
          ${config.orgId}, 'rms_alert', ${title}, ${message},
          ${JSON.stringify([config.orgId])}::jsonb, 'rms_alert', 'pending'
        )
      `);
    } catch (err) {
      logger.warn(MODULE, "Failed to create in-app notification (non-critical)", { error: err });
    }
  }

  private async queueEmailNotification(
    config: AlertConfig, severity: string, title: string, message: string
  ): Promise<void> {
    try {
      const subject = `[RMS ${severity.toUpperCase()}] ${title}`;
      const body = `${message}\n\nVessel: ${config.vesselId}\nAlert Type: ${config.alertType}\nSeverity: ${severity}`;
      await db.execute(sql`
        INSERT INTO notification_queue (
          org_id, notification_type, subject, body, recipients, related_entity_type, status
        ) VALUES (
          ${config.orgId}, 'rms_email_alert', ${subject}, ${body},
          ${JSON.stringify([config.orgId])}::jsonb, 'rms_alert', 'pending'
        )
      `);
    } catch (err) {
      logger.warn(MODULE, "Failed to queue email notification (non-critical)", { error: err });
    }
  }

  private async getVesselAlertConfigs(orgId: string, vesselId: string): Promise<AlertConfig[]> {
    const cacheKey = `${orgId}:${vesselId}`;
    const cached = this.configCache.get(cacheKey);
    if (cached && Date.now() - cached.loadedAt < this.CACHE_TTL_MS) {
      return cached.configs;
    }

    try {
      const result = await db.execute(sql`
        SELECT * FROM rms_alert_configs
        WHERE org_id = ${orgId} AND vessel_id = ${vesselId} AND enabled = true
      `);

      const configs: AlertConfig[] = getRows(result).map((r: any) => ({
        id: r.id,
        vesselId: r.vessel_id,
        orgId: r.org_id,
        alertType: r.alert_type,
        name: r.name,
        config: r.config,
        cooldownMinutes: r.cooldown_minutes,
        lastTriggeredAt: r.last_triggered_at,
        notifyEmail: r.notify_email,
        notifyInApp: r.notify_in_app,
      }));

      this.configCache.set(cacheKey, { configs, loadedAt: Date.now() });
      return configs;
    } catch (err) {
      logger.error(MODULE, "Failed to load alert configs", { error: err });
      return [];
    }
  }

  clearCache(): void {
    this.configCache.clear();
  }
}

export const rmsAlertService = new RmsAlertService();
