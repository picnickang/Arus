import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db } from "../../../../db";
import {
  twinEvents,
  equipmentTelemetry,
  assetTwins,
  type TwinEvent,
  type InsertTwinEvent,
} from "@shared/schema";
import type { ReplayPort, TimelineEntry, TimelineQuery, AnomalyTimelineQuery } from "./ports";

export class ReplayAdapter implements ReplayPort {
  async logEvent(data: InsertTwinEvent): Promise<TwinEvent> {
    const [result] = await db.insert(twinEvents).values(data).returning();
    return result;
  }

  async getTimeline(query: TimelineQuery): Promise<TimelineEntry[]> {
    const { orgId, twinId, startTime, endTime, limit = 200 } = query;

    const events = await db
      .select()
      .from(twinEvents)
      .where(
        and(
          eq(twinEvents.orgId, orgId),
          eq(twinEvents.twinId, twinId),
          gte(twinEvents.timestamp, startTime),
          lte(twinEvents.timestamp, endTime)
        )
      )
      .orderBy(desc(twinEvents.timestamp))
      .limit(limit);

    const telemetryEntries = await this.getTelemetryContext(orgId, twinId, startTime, endTime, Math.max(50, limit));

    const merged: TimelineEntry[] = [
      ...events.map((e) => ({
        id: e.id,
        twinId: e.twinId,
        timestamp: e.timestamp,
        eventType: e.eventType,
        payload: e.payload,
        source: e.source,
      })),
      ...telemetryEntries,
    ];

    merged.sort((a, b) => {
      const ta = a.timestamp ? a.timestamp.getTime() : 0;
      const tb = b.timestamp ? b.timestamp.getTime() : 0;
      return tb - ta;
    });

    return merged.slice(0, limit);
  }

  async getTimelineAroundAnomaly(query: AnomalyTimelineQuery): Promise<TimelineEntry[]> {
    const { orgId, twinId, anomalyTimestamp, windowMinutes = 30 } = query;
    const halfWindow = windowMinutes * 60 * 1000;
    const startTime = new Date(anomalyTimestamp.getTime() - halfWindow);
    const endTime = new Date(anomalyTimestamp.getTime() + halfWindow);

    return this.getTimeline({ orgId, twinId, startTime, endTime, limit: 200 });
  }

  private async getTelemetryContext(
    orgId: string,
    twinId: string,
    startTime: Date,
    endTime: Date,
    limit: number
  ): Promise<TimelineEntry[]> {
    try {
      const [twin] = await db
        .select()
        .from(assetTwins)
        .where(and(eq(assetTwins.orgId, orgId), eq(assetTwins.id, twinId)))
        .limit(1);

      if (!twin) return [];

      const telemetry = await db
        .select()
        .from(equipmentTelemetry)
        .where(
          and(
            eq(equipmentTelemetry.orgId, orgId),
            eq(equipmentTelemetry.equipmentId, twin.equipmentId),
            gte(equipmentTelemetry.ts, startTime),
            lte(equipmentTelemetry.ts, endTime)
          )
        )
        .orderBy(desc(equipmentTelemetry.ts))
        .limit(limit);

      return telemetry.map((t) => ({
        id: t.id,
        twinId,
        timestamp: t.ts,
        eventType: "telemetry",
        payload: {
          sensorType: t.sensorType,
          value: t.value,
          unit: t.unit,
          status: t.status,
        },
        source: "telemetry",
      }));
    } catch {
      return [];
    }
  }
}
