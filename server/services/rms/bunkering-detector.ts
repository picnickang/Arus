import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../utils/logger";
import type { FmccSnapshot } from "../../integrations/fmcc-types";

const MODULE = "BunkeringDetector";

interface ActiveBunkering {
  eventId: string;
  vesselId: string;
  orgId: string;
  startedAt: Date;
  readings: Array<{ timestamp: Date; flowKgPerH: number }>;
  peakFlow: number;
  totalKg: number;
  fuelType: string;
  density?: number;
  temperature?: number;
}

function getFirstRow(result: any): any | undefined {
  const rows = Array.isArray(result) ? result : (result as any)?.rows || [];
  return rows[0];
}

const BUNKER_FLOW_THRESHOLD_KG_PER_H = 500;
const BUNKER_END_QUIET_READINGS = 3;

class BunkeringDetectorService {
  private activeBunkerings = new Map<string, ActiveBunkering>();
  private quietCounters = new Map<string, number>();

  async processSnapshot(snapshot: FmccSnapshot): Promise<void> {
    const bunkerFlow = snapshot.fuel.bunkerFlowKgPerH;
    if (bunkerFlow === undefined) return;

    const vesselKey = snapshot.vesselId;
    const isBunkering = bunkerFlow > BUNKER_FLOW_THRESHOLD_KG_PER_H;
    const active = this.activeBunkerings.get(vesselKey);

    if (isBunkering && !active) {
      await this.startBunkering(snapshot, bunkerFlow);
    } else if (isBunkering && active) {
      this.updateBunkering(active, snapshot, bunkerFlow);
      this.quietCounters.set(vesselKey, 0);
    } else if (!isBunkering && active) {
      const quietCount = (this.quietCounters.get(vesselKey) || 0) + 1;
      this.quietCounters.set(vesselKey, quietCount);

      if (quietCount >= BUNKER_END_QUIET_READINGS) {
        await this.endBunkering(active);
        this.activeBunkerings.delete(vesselKey);
        this.quietCounters.delete(vesselKey);
      }
    }
  }

  private async startBunkering(snapshot: FmccSnapshot, flowKgPerH: number): Promise<void> {
    try {
      const result = await db.execute(sql`
        INSERT INTO rms_bunkering_events (
          org_id, vessel_id, started_at, status, fuel_type, density_at_15c, temperature_c, source
        ) VALUES (
          ${snapshot.orgId}, ${snapshot.vesselId}, ${new Date(snapshot.timestamp)},
          'in_progress', 'fo',
          ${snapshot.fuel.foDensity ?? null}, ${snapshot.fuel.foTemperature ?? null},
          'auto'
        ) RETURNING id
      `);

      const row = getFirstRow(result);
      if (!row) return;

      const active: ActiveBunkering = {
        eventId: row.id,
        vesselId: snapshot.vesselId,
        orgId: snapshot.orgId,
        startedAt: new Date(snapshot.timestamp),
        readings: [{ timestamp: new Date(snapshot.timestamp), flowKgPerH }],
        peakFlow: flowKgPerH,
        totalKg: 0,
        fuelType: 'fo',
        density: snapshot.fuel.foDensity,
        temperature: snapshot.fuel.foTemperature,
      };

      this.activeBunkerings.set(snapshot.vesselId, active);
      logger.info(MODULE, "Bunkering started", { vesselId: snapshot.vesselId, eventId: row.id, flowKgPerH });

      await this.createAlert(snapshot.orgId, snapshot.vesselId, 'bunkering', 'info',
        'Bunkering Started',
        `Bunkering operation detected on vessel. Flow rate: ${flowKgPerH.toFixed(1)} kg/h`,
        { eventId: row.id, flowKgPerH }
      );
    } catch (err) {
      logger.error(MODULE, "Failed to start bunkering event", { error: err });
    }
  }

  private updateBunkering(active: ActiveBunkering, snapshot: FmccSnapshot, flowKgPerH: number): void {
    active.readings.push({ timestamp: new Date(snapshot.timestamp), flowKgPerH });
    if (flowKgPerH > active.peakFlow) active.peakFlow = flowKgPerH;
    if (active.density === undefined && snapshot.fuel.foDensity) active.density = snapshot.fuel.foDensity;
  }

  private async endBunkering(active: ActiveBunkering): Promise<void> {
    try {
      const endTime = active.readings.length > 0
        ? active.readings[active.readings.length - 1].timestamp
        : new Date();

      const durationHours = (endTime.getTime() - active.startedAt.getTime()) / (1000 * 60 * 60);
      const avgFlow = active.readings.length > 0
        ? active.readings.reduce((sum, r) => sum + r.flowKgPerH, 0) / active.readings.length
        : 0;

      const volumeKg = avgFlow * durationHours;
      const volumeLitres = active.density && active.density > 0
        ? (volumeKg / active.density) * 1000
        : volumeKg / 0.85;

      await db.execute(sql`
        UPDATE rms_bunkering_events SET
          ended_at = ${endTime},
          status = 'completed',
          volume_kg = ${volumeKg},
          volume_litres = ${volumeLitres},
          avg_flow_kg_per_h = ${avgFlow},
          peak_flow_kg_per_h = ${active.peakFlow},
          density_at_15c = ${active.density ?? null},
          temperature_c = ${active.temperature ?? null},
          updated_at = NOW()
        WHERE id = ${active.eventId}
      `);

      logger.info(MODULE, "Bunkering completed", {
        vesselId: active.vesselId,
        eventId: active.eventId,
        durationHours: durationHours.toFixed(2),
        volumeKg: volumeKg.toFixed(1),
        avgFlow: avgFlow.toFixed(1),
      });

      await this.createAlert(active.orgId, active.vesselId, 'bunkering', 'info',
        'Bunkering Completed',
        `Bunkering operation completed. Volume: ${(volumeKg / 1000).toFixed(2)} MT, Duration: ${(durationHours * 60).toFixed(0)} min`,
        { eventId: active.eventId, volumeKg, volumeLitres, durationHours, avgFlow }
      );
    } catch (err) {
      logger.error(MODULE, "Failed to end bunkering event", { error: err });
    }
  }

  private async createAlert(
    orgId: string, vesselId: string, alertType: string, severity: string,
    title: string, message: string, data: Record<string, any>
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO rms_alert_log (org_id, vessel_id, alert_type, severity, title, message, data)
        VALUES (${orgId}, ${vesselId}, ${alertType}, ${severity}, ${title}, ${message}, ${JSON.stringify(data)})
      `);
    } catch (err) {
      logger.error(MODULE, "Failed to create alert", { error: err });
    }
  }

  getActiveBunkerings(): Array<{ vesselId: string; eventId: string; startedAt: Date }> {
    return [...this.activeBunkerings.values()].map(a => ({
      vesselId: a.vesselId, eventId: a.eventId, startedAt: a.startedAt,
    }));
  }
}

export const bunkeringDetector = new BunkeringDetectorService();
