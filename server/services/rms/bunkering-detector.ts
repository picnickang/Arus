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
const FLOW_REVERSAL_THRESHOLD_KG_PER_H = -50;
const SUDDEN_INTAKE_SPIKE_FACTOR = 3.0;

class BunkeringDetectorService {
  private activeBunkerings = new Map<string, ActiveBunkering>();
  private quietCounters = new Map<string, number>();
  private previousFlows = new Map<string, number[]>();

  async processSnapshot(snapshot: FmccSnapshot): Promise<void> {
    const bunkerFlow = snapshot.fuel.bunkerFlowKgPerH;

    const vesselKey = snapshot.vesselId;
    const isBunkeringByDedicatedMeter =
      bunkerFlow !== undefined && bunkerFlow > BUNKER_FLOW_THRESHOLD_KG_PER_H;
    const isBunkeringByReversal = this.detectFlowReversal(snapshot);
    const isBunkeringBySurge = this.detectSuddenIntakeSurge(snapshot);
    const isBunkering = isBunkeringByDedicatedMeter || isBunkeringByReversal || isBunkeringBySurge;

    const effectiveFlow =
      bunkerFlow ?? (isBunkeringByReversal ? Math.abs(snapshot.fuel.totalFlowKgPerH ?? 0) : 0);
    const active = this.activeBunkerings.get(vesselKey);

    this.trackFlowHistory(vesselKey, snapshot.fuel.totalFlowKgPerH);

    if (isBunkering && !active) {
      const detectionMethod = isBunkeringByDedicatedMeter
        ? "bunker_meter"
        : isBunkeringByReversal
          ? "flow_reversal"
          : "surge_detection";
      await this.startBunkering(snapshot, effectiveFlow, detectionMethod);
    } else if (isBunkering && active) {
      this.updateBunkering(active, snapshot, effectiveFlow);
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

  private detectFlowReversal(snapshot: FmccSnapshot): boolean {
    const totalFlow = snapshot.fuel.totalFlowKgPerH;
    if (totalFlow === undefined) {
      return false;
    }
    return totalFlow < FLOW_REVERSAL_THRESHOLD_KG_PER_H;
  }

  private detectSuddenIntakeSurge(snapshot: FmccSnapshot): boolean {
    const totalFlow = snapshot.fuel.totalFlowKgPerH;
    if (totalFlow === undefined || totalFlow <= 0) {
      return false;
    }

    const history = this.previousFlows.get(snapshot.vesselId);
    if (!history || history.length < 5) {
      return false;
    }

    const avgRecentFlow = history.slice(-5).reduce((s, v) => s + v, 0) / 5;
    if (avgRecentFlow <= 0) {
      return false;
    }

    return (
      totalFlow > avgRecentFlow * SUDDEN_INTAKE_SPIKE_FACTOR &&
      totalFlow > BUNKER_FLOW_THRESHOLD_KG_PER_H
    );
  }

  private trackFlowHistory(vesselId: string, flow: number | undefined): void {
    if (flow === undefined) {
      return;
    }
    const history = this.previousFlows.get(vesselId) || [];
    history.push(flow);
    if (history.length > 20) {
      history.shift();
    }
    this.previousFlows.set(vesselId, history);
  }

  private async startBunkering(
    snapshot: FmccSnapshot,
    flowKgPerH: number,
    detectionMethod: string = "bunker_meter"
  ): Promise<void> {
    try {
      const result = await db.execute(sql`
        INSERT INTO rms_bunkering_events (
          org_id, vessel_id, started_at, status, fuel_type, density_at_15c, temperature_c, source
        ) VALUES (
          ${snapshot.orgId}, ${snapshot.vesselId}, ${new Date(snapshot.timestamp)},
          'in_progress', 'hfo',
          ${snapshot.fuel.foDensity ?? null}, ${snapshot.fuel.foTemperature ?? null},
          ${`auto:${detectionMethod}`}
        ) RETURNING id
      `);

      const row = getFirstRow(result);
      if (!row) {
        return;
      }

      const active: ActiveBunkering = {
        eventId: row.id,
        vesselId: snapshot.vesselId,
        orgId: snapshot.orgId,
        startedAt: new Date(snapshot.timestamp),
        readings: [{ timestamp: new Date(snapshot.timestamp), flowKgPerH }],
        peakFlow: flowKgPerH,
        totalKg: 0,
        fuelType: "hfo",
        density: snapshot.fuel.foDensity,
        temperature: snapshot.fuel.foTemperature,
      };

      this.activeBunkerings.set(snapshot.vesselId, active);
      logger.info(MODULE, "Bunkering started", {
        vesselId: snapshot.vesselId,
        eventId: row.id,
        flowKgPerH,
      });

      domainEventBus.emit(
        "bunkering.started",
        createDomainEvent(
          "bunkering.started",
          snapshot.orgId,
          {
            eventId: row.id,
            vesselId: snapshot.vesselId,
            flowKgPerH,
            startedAt: new Date(snapshot.timestamp),
          },
          { aggregateId: row.id, aggregateType: "bunkering_event" }
        )
      );

      await this.createAlert(
        snapshot.orgId,
        snapshot.vesselId,
        "bunkering",
        "info",
        "Bunkering Started",
        `Bunkering operation detected on vessel. Flow rate: ${flowKgPerH.toFixed(1)} kg/h`,
        { eventId: row.id, flowKgPerH }
      );
    } catch (err) {
      logger.error(MODULE, "Failed to start bunkering event", { error: err });
    }
  }

  private updateBunkering(
    active: ActiveBunkering,
    snapshot: FmccSnapshot,
    flowKgPerH: number
  ): void {
    active.readings.push({ timestamp: new Date(snapshot.timestamp), flowKgPerH });
    if (flowKgPerH > active.peakFlow) {
      active.peakFlow = flowKgPerH;
    }
    if (active.density === undefined && snapshot.fuel.foDensity) {
      active.density = snapshot.fuel.foDensity;
    }
  }

  private async endBunkering(active: ActiveBunkering): Promise<void> {
    try {
      const endTime =
        active.readings.length > 0
          ? active.readings[active.readings.length - 1].timestamp
          : new Date();

      const durationHours = (endTime.getTime() - active.startedAt.getTime()) / (1000 * 60 * 60);
      const avgFlow =
        active.readings.length > 0
          ? active.readings.reduce((sum, r) => sum + r.flowKgPerH, 0) / active.readings.length
          : 0;

      const volumeKg = avgFlow * durationHours;
      const volumeLitres =
        active.density && active.density > 0 ? (volumeKg / active.density) * 1000 : volumeKg / 0.85;

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

      domainEventBus.emit(
        "bunkering.completed",
        createDomainEvent(
          "bunkering.completed",
          active.orgId,
          {
            eventId: active.eventId,
            vesselId: active.vesselId,
            volumeKg,
            volumeLitres,
            durationHours,
            avgFlowKgPerH: avgFlow,
            peakFlowKgPerH: active.peakFlow,
            startedAt: active.startedAt,
            endedAt: endTime,
          },
          { aggregateId: active.eventId, aggregateType: "bunkering_event" }
        )
      );

      await this.createAlert(
        active.orgId,
        active.vesselId,
        "bunkering",
        "info",
        "Bunkering Completed",
        `Bunkering operation completed. Volume: ${(volumeKg / 1000).toFixed(2)} MT, Duration: ${(durationHours * 60).toFixed(0)} min`,
        { eventId: active.eventId, volumeKg, volumeLitres, durationHours, avgFlow }
      );

      await this.createEngineLogBunkeringEntry(active, endTime, volumeKg, volumeLitres, avgFlow);
    } catch (err) {
      logger.error(MODULE, "Failed to end bunkering event", { error: err });
    }
  }

  private async createEngineLogBunkeringEntry(
    active: ActiveBunkering,
    endTime: Date,
    volumeKg: number,
    volumeLitres: number,
    avgFlow: number
  ): Promise<void> {
    try {
      const logDate = endTime.toISOString().slice(0, 10);
      const fuelType = active.fuelType.toLowerCase();
      const volumeMT = volumeKg / 1000;

      const bunkeringHfoVal = fuelType === "hfo" ? volumeMT : null;
      const bunkeringMdoVal = fuelType === "mdo" || fuelType === "do" ? volumeMT : null;
      const bunkeringMgoVal = fuelType === "mgo" ? volumeMT : null;
      const remarks = `Auto-detected bunkering: ${volumeMT.toFixed(2)} MT ${active.fuelType.toUpperCase()}, Duration: ${((endTime.getTime() - active.startedAt.getTime()) / 60000).toFixed(0)} min, Avg flow: ${avgFlow.toFixed(1)} kg/h, Peak: ${active.peakFlow.toFixed(1)} kg/h${active.density ? `, Density: ${active.density.toFixed(4)} kg/m³` : ""}`;

      await db.execute(sql`
        INSERT INTO engine_log_daily (
          org_id, vessel_id, log_date,
          bunkering_hfo, bunkering_mdo, bunkering_mgo,
          bunkering_supplier, remarks, status
        ) VALUES (
          ${active.orgId}, ${active.vesselId}, ${logDate},
          ${bunkeringHfoVal}, ${bunkeringMdoVal}, ${bunkeringMgoVal},
          ${"FMCC Auto-Detection"}, ${remarks}, 'open'
        )
        ON CONFLICT (vessel_id, log_date) DO UPDATE SET
          bunkering_hfo = COALESCE(engine_log_daily.bunkering_hfo, 0) + COALESCE(EXCLUDED.bunkering_hfo, 0),
          bunkering_mdo = COALESCE(engine_log_daily.bunkering_mdo, 0) + COALESCE(EXCLUDED.bunkering_mdo, 0),
          bunkering_mgo = COALESCE(engine_log_daily.bunkering_mgo, 0) + COALESCE(EXCLUDED.bunkering_mgo, 0),
          remarks = engine_log_daily.remarks || E'\n' || EXCLUDED.remarks,
          updated_at = NOW()
      `);
      logger.info(MODULE, "Engine log daily bunkering entry created/updated", {
        eventId: active.eventId,
        logDate,
      });
    } catch (err) {
      logger.warn(MODULE, "Failed to create engine log bunkering entry (non-critical)", {
        error: err,
      });
    }
  }

  private async createAlert(
    orgId: string,
    vesselId: string,
    alertType: string,
    severity: string,
    title: string,
    message: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      const result = await db.execute(sql`
        INSERT INTO rms_alert_log (org_id, vessel_id, alert_type, severity, title, message, data)
        VALUES (${orgId}, ${vesselId}, ${alertType}, ${severity}, ${title}, ${message}, ${JSON.stringify(data)})
        RETURNING id
      `);

      const row = getFirstRow(result);
      if (row) {
        domainEventBus.emit(
          "rms.alert_triggered",
          createDomainEvent(
            "rms.alert_triggered",
            orgId,
            { alertLogId: row.id, vesselId, alertType, severity, title, message },
            { aggregateId: row.id, aggregateType: "rms_alert" }
          )
        );
      }
    } catch (err) {
      logger.error(MODULE, "Failed to create alert", { error: err });
    }
  }

  getActiveBunkerings(): Array<{ vesselId: string; eventId: string; startedAt: Date }> {
    return [...this.activeBunkerings.values()].map((a) => ({
      vesselId: a.vesselId,
      eventId: a.eventId,
      startedAt: a.startedAt,
    }));
  }
}

export const bunkeringDetector = new BunkeringDetectorService();
