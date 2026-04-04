import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../utils/logger";
import { domainEventBus } from "../../lib/domain-event-bus";
import { createDomainEvent } from "../../lib/domain-event-bus/types";
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

      domainEventBus.emit("bunkering.started", createDomainEvent(
        "bunkering.started", snapshot.orgId,
        { eventId: row.id, vesselId: snapshot.vesselId, flowKgPerH, startedAt: new Date(snapshot.timestamp) },
        { aggregateId: row.id, aggregateType: "bunkering_event" }
      ));

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

      domainEventBus.emit("bunkering.completed", createDomainEvent(
        "bunkering.completed", active.orgId,
        {
          eventId: active.eventId, vesselId: active.vesselId,
          volumeKg, volumeLitres, durationHours,
          avgFlowKgPerH: avgFlow, peakFlowKgPerH: active.peakFlow,
          startedAt: active.startedAt, endedAt: endTime,
        },
        { aggregateId: active.eventId, aggregateType: "bunkering_event" }
      ));

      await this.createAlert(active.orgId, active.vesselId, 'bunkering', 'info',
        'Bunkering Completed',
        `Bunkering operation completed. Volume: ${(volumeKg / 1000).toFixed(2)} MT, Duration: ${(durationHours * 60).toFixed(0)} min`,
        { eventId: active.eventId, volumeKg, volumeLitres, durationHours, avgFlow }
      );

      await this.createEngineLogBunkeringEntry(active, endTime, volumeKg, volumeLitres, avgFlow);
    } catch (err) {
      logger.error(MODULE, "Failed to end bunkering event", { error: err });
    }
  }

  private async createEngineLogBunkeringEntry(
    active: ActiveBunkering, endTime: Date,
    volumeKg: number, volumeLitres: number, avgFlow: number
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO log_entries (
          org_id, vessel_id, log_type, category, timestamp, recorded_by,
          title, description, metadata
        ) VALUES (
          ${active.orgId}, ${active.vesselId}, 'engine', 'bunkering',
          ${endTime}, 'FMCC Auto-Detection',
          ${'Bunkering Operation - ' + (volumeKg / 1000).toFixed(2) + ' MT'},
          ${'Auto-detected bunkering operation. Volume: ' + (volumeKg / 1000).toFixed(2) + ' MT (' + volumeLitres.toFixed(0) + ' L), Duration: ' + ((endTime.getTime() - active.startedAt.getTime()) / 60000).toFixed(0) + ' min, Avg flow: ' + avgFlow.toFixed(1) + ' kg/h, Peak flow: ' + active.peakFlow.toFixed(1) + ' kg/h, Fuel type: ' + active.fuelType.toUpperCase() + (active.density ? ', Density: ' + active.density.toFixed(4) + ' kg/m³' : '')},
          ${JSON.stringify({
            bunkeringEventId: active.eventId,
            volumeKg, volumeLitres, avgFlowKgPerH: avgFlow,
            peakFlowKgPerH: active.peakFlow, fuelType: active.fuelType,
            density: active.density, startedAt: active.startedAt.toISOString(),
            endedAt: endTime.toISOString(), source: 'fmcc-auto-detection',
          })}
        )
      `);
      logger.info(MODULE, "Engine log bunkering entry created", { eventId: active.eventId });
    } catch (err) {
      logger.warn(MODULE, "Failed to create engine log bunkering entry (non-critical)", { error: err });
    }
  }

  private async createAlert(
    orgId: string, vesselId: string, alertType: string, severity: string,
    title: string, message: string, data: Record<string, any>
  ): Promise<void> {
    try {
      const result = await db.execute(sql`
        INSERT INTO rms_alert_log (org_id, vessel_id, alert_type, severity, title, message, data)
        VALUES (${orgId}, ${vesselId}, ${alertType}, ${severity}, ${title}, ${message}, ${JSON.stringify(data)})
        RETURNING id
      `);

      const row = getFirstRow(result);
      if (row) {
        domainEventBus.emit("rms.alert_triggered", createDomainEvent(
          "rms.alert_triggered", orgId,
          { alertLogId: row.id, vesselId, alertType, severity, title, message },
          { aggregateId: row.id, aggregateType: "rms_alert" }
        ));
      }
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
