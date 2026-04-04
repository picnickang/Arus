import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../utils/logger";
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
}

function getRows(result: any): any[] {
  return Array.isArray(result) ? result : (result as any)?.rows || [];
}

class RmsAlertService {
  private configCache = new Map<string, { configs: AlertConfig[]; loadedAt: number }>();
  private readonly CACHE_TTL_MS = 60_000;

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

    const totalCumulativeKg = (snapshot.fuel.foCumulativeKg ?? 0) + (snapshot.fuel.doCumulativeKg ?? 0);
    const totalCumulativeMt = totalCumulativeKg / 1000;

    if (totalCumulativeMt > maxDailyMt && this.canTrigger(config)) {
      await this.triggerAlert(config, 'warning',
        `Daily Consumption Exceeded: ${config.name}`,
        `Daily consumption ${totalCumulativeMt.toFixed(2)} MT exceeds limit of ${maxDailyMt} MT`,
        { currentMt: totalCumulativeMt, maxDailyMt }
      );
    }
  }

  private async checkGeofence(snapshot: FmccSnapshot, config: AlertConfig): Promise<void> {
    const { centerLat, centerLon, radiusNm, triggerOn } = config.config;
    if (snapshot.navigation?.latDeg == null || snapshot.navigation?.lonDeg == null) return;
    if (centerLat == null || centerLon == null || radiusNm == null) return;

    const distNm = this.haversineNm(
      snapshot.navigation.latDeg, snapshot.navigation.lonDeg,
      centerLat, centerLon
    );

    const inside = distNm <= radiusNm;
    const shouldTrigger = (triggerOn === 'enter' && inside) ||
      (triggerOn === 'exit' && !inside) ||
      (triggerOn === 'both');

    if (shouldTrigger && this.canTrigger(config)) {
      await this.triggerAlert(config, 'info',
        `Geofence ${inside ? 'Entry' : 'Exit'}: ${config.name}`,
        `Vessel ${inside ? 'entered' : 'exited'} geofence zone "${config.name}" (distance: ${distNm.toFixed(1)} NM, radius: ${radiusNm} NM)`,
        { lat: snapshot.navigation.latDeg, lon: snapshot.navigation.lonDeg, distNm, radiusNm, inside }
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
      await db.execute(sql`
        INSERT INTO rms_alert_log (org_id, vessel_id, alert_config_id, alert_type, severity, title, message, data)
        VALUES (${config.orgId}, ${config.vesselId}, ${config.id}, ${config.alertType}, ${severity}, ${title}, ${message}, ${JSON.stringify(data)})
      `);

      await db.execute(sql`
        UPDATE rms_alert_configs SET last_triggered_at = NOW(), updated_at = NOW()
        WHERE id = ${config.id}
      `);

      config.lastTriggeredAt = new Date();

      logger.info(MODULE, "Alert triggered", { configId: config.id, title, severity });
    } catch (err) {
      logger.error(MODULE, "Failed to trigger alert", { error: err });
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
