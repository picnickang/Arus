// @ts-nocheck
import { db } from "../db";
import {
  vesselTrackLog,
  equipmentTelemetry,
  equipment,
  InsertVesselTrackLog,
} from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

// Earth radius in nautical miles
const EARTH_RADIUS_NM = 3440.065;

// Minimum distance to log a new position (nautical miles)
const MIN_DISTANCE_NM = 0.05; // ~100 meters

// Maximum time between logged positions (minutes)
const MAX_TIME_GAP_MINUTES = 5;

export interface TrackLogResult {
  success: boolean;
  recordsCreated: number;
  recordsSkipped: number;
  errors: string[];
}

export interface Position {
  latitude: number;
  longitude: number;
  timestamp: Date;
  sog?: number;
  cog?: number;
  heading?: number;
  source: string;
  equipmentId?: string;
}

/**
 * Vessel Track Log Service
 *
 * Provides:
 * 1. Position logging with intelligent deduplication
 * 2. Track history queries
 * 3. Export to GPX/KML formats
 */
export class TrackLogService {
  /**
   * Calculate distance between two positions using Haversine formula
   */
  private calculateDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_NM * c;
  }

  /**
   * Determine navigation status from speed
   */
  private getNavStatus(sog: number | undefined): string {
    if (!sog || sog < 0.5) {
      return "anchored";
    }
    if (sog < 3) {
      return "maneuvering";
    }
    return "underway";
  }

  /**
   * Get the last logged position for a vessel
   */
  async getLastPosition(orgId: string, vesselId: string): Promise<Position | null> {
    const lastPos = await db
      .select({
        latitude: vesselTrackLog.latitude,
        longitude: vesselTrackLog.longitude,
        timestamp: vesselTrackLog.timestamp,
        sog: vesselTrackLog.sog,
        cog: vesselTrackLog.cog,
        heading: vesselTrackLog.heading,
        source: vesselTrackLog.source,
        equipmentId: vesselTrackLog.equipmentId,
      })
      .from(vesselTrackLog)
      .where(and(eq(vesselTrackLog.orgId, orgId), eq(vesselTrackLog.vesselId, vesselId)))
      .orderBy(sql`${vesselTrackLog.timestamp} DESC`)
      .limit(1);

    if (lastPos.length === 0) {
      return null;
    }

    return {
      latitude: lastPos[0].latitude,
      longitude: lastPos[0].longitude,
      timestamp: lastPos[0].timestamp,
      sog: lastPos[0].sog ?? undefined,
      cog: lastPos[0].cog ?? undefined,
      heading: lastPos[0].heading ?? undefined,
      source: lastPos[0].source,
      equipmentId: lastPos[0].equipmentId ?? undefined,
    };
  }

  /**
   * Log a new position with deduplication
   */
  async logPosition(
    orgId: string,
    vesselId: string,
    position: Position,
    forceLog: boolean = false
  ): Promise<string | null> {
    // Get the last logged position
    const lastPosition = await this.getLastPosition(orgId, vesselId);

    let distanceFromPrev: number | null = null;
    let timeFromPrevMinutes: number | null = null;
    let shouldLog = forceLog;

    if (lastPosition) {
      distanceFromPrev = this.calculateDistanceNm(
        lastPosition.latitude,
        lastPosition.longitude,
        position.latitude,
        position.longitude
      );

      timeFromPrevMinutes = Math.round(
        (position.timestamp.getTime() - lastPosition.timestamp.getTime()) / (1000 * 60)
      );

      // Log if moved more than minimum distance OR time gap exceeded
      shouldLog =
        forceLog ||
        distanceFromPrev >= MIN_DISTANCE_NM ||
        timeFromPrevMinutes >= MAX_TIME_GAP_MINUTES;
    } else {
      // Always log if no previous position
      shouldLog = true;
    }

    if (!shouldLog) {
      return null;
    }

    const logEntry: InsertVesselTrackLog = {
      orgId,
      vesselId,
      timestamp: position.timestamp,
      latitude: position.latitude,
      longitude: position.longitude,
      sog: position.sog,
      cog: position.cog,
      heading: position.heading,
      navStatus: this.getNavStatus(position.sog),
      source: position.source,
      equipmentId: position.equipmentId,
      distanceFromPrevNm: distanceFromPrev,
      timeFromPrevMinutes,
    };

    const result = await db
      .insert(vesselTrackLog)
      .values(logEntry)
      .returning({ id: vesselTrackLog.id });

    return result[0]?.id || null;
  }

  /**
   * Process telemetry data and extract position logs
   */
  async processGpsTelemetry(
    orgId: string,
    vesselId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TrackLogResult> {
    const result: TrackLogResult = {
      success: true,
      recordsCreated: 0,
      recordsSkipped: 0,
      errors: [],
    };

    try {
      // Get GPS/Navigation equipment for this vessel
      const gpsEquipment = await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(
          and(
            eq(equipment.vesselId, vesselId),
            sql`(${equipment.category} = 'navigation' OR ${equipment.equipmentType} ILIKE '%gps%' OR ${equipment.equipmentType} ILIKE '%ais%')`
          )
        );

      // Also check for position data in all equipment telemetry
      const telemetryData = await db
        .select({
          id: equipmentTelemetry.id,
          equipmentId: equipmentTelemetry.equipmentId,
          timestamp: equipmentTelemetry.timestamp,
          readings: equipmentTelemetry.readings,
        })
        .from(equipmentTelemetry)
        .where(
          and(
            eq(equipmentTelemetry.orgId, orgId),
            gte(equipmentTelemetry.timestamp, startDate),
            lte(equipmentTelemetry.timestamp, endDate),
            sql`${equipmentTelemetry.readings}->>'latitude' IS NOT NULL`
          )
        )
        .orderBy(equipmentTelemetry.timestamp);

      for (const telemetry of telemetryData) {
        const readings = telemetry.readings as Record<string, unknown>;
        const lat = Number.parseFloat(String(readings.latitude));
        const lon = Number.parseFloat(String(readings.longitude));

        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          continue;
        }

        // Validate coordinates
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          continue;
        }

        const position: Position = {
          latitude: lat,
          longitude: lon,
          timestamp: telemetry.timestamp,
          sog: readings.sog ? Number.parseFloat(String(readings.sog)) : undefined,
          cog: readings.cog ? Number.parseFloat(String(readings.cog)) : undefined,
          heading: readings.heading ? Number.parseFloat(String(readings.heading)) : undefined,
          source: "gps",
          equipmentId: telemetry.equipmentId,
        };

        const logId = await this.logPosition(orgId, vesselId, position);

        if (logId) {
          result.recordsCreated++;
        } else {
          result.recordsSkipped++;
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * Get track history for a vessel
   */
  async getTrackHistory(
    orgId: string,
    vesselId: string,
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<
    Array<{
      id: string;
      timestamp: Date;
      latitude: number;
      longitude: number;
      sog: number | null;
      cog: number | null;
      heading: number | null;
      navStatus: string | null;
      source: string;
    }>
  > {
    let query = db
      .select({
        id: vesselTrackLog.id,
        timestamp: vesselTrackLog.timestamp,
        latitude: vesselTrackLog.latitude,
        longitude: vesselTrackLog.longitude,
        sog: vesselTrackLog.sog,
        cog: vesselTrackLog.cog,
        heading: vesselTrackLog.heading,
        navStatus: vesselTrackLog.navStatus,
        source: vesselTrackLog.source,
      })
      .from(vesselTrackLog)
      .where(
        and(
          eq(vesselTrackLog.orgId, orgId),
          eq(vesselTrackLog.vesselId, vesselId),
          gte(vesselTrackLog.timestamp, startDate),
          lte(vesselTrackLog.timestamp, endDate)
        )
      )
      .orderBy(vesselTrackLog.timestamp);

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    return query;
  }

  /**
   * Export track to GPX format
   */
  async exportToGPX(
    orgId: string,
    vesselId: string,
    vesselName: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const tracks = await this.getTrackHistory(orgId, vesselId, startDate, endDate);

    const trackpoints = tracks
      .map(
        (t) => `
      <trkpt lat="${t.latitude}" lon="${t.longitude}">
        <time>${t.timestamp.toISOString()}</time>
        ${t.sog ? `<speed>${(t.sog * 0.514444).toFixed(2)}</speed>` : ""}
        ${t.cog ? `<course>${t.cog.toFixed(1)}</course>` : ""}
      </trkpt>`
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ARUS Marine">
  <metadata>
    <name>${vesselName} Track</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${vesselName}</name>
    <trkseg>
      ${trackpoints}
    </trkseg>
  </trk>
</gpx>`;
  }

  /**
   * Get track statistics
   */
  async getTrackStats(
    orgId: string,
    vesselId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalDistanceNm: number;
    avgSpeedKn: number;
    maxSpeedKn: number;
    trackPointCount: number;
    startPosition: { lat: number; lon: number } | null;
    endPosition: { lat: number; lon: number } | null;
  }> {
    const stats = await db
      .select({
        totalDistance: sql<number>`sum(${vesselTrackLog.distanceFromPrevNm})`,
        avgSpeed: sql<number>`avg(${vesselTrackLog.sog})`,
        maxSpeed: sql<number>`max(${vesselTrackLog.sog})`,
        trackPoints: sql<number>`count(*)`,
      })
      .from(vesselTrackLog)
      .where(
        and(
          eq(vesselTrackLog.orgId, orgId),
          eq(vesselTrackLog.vesselId, vesselId),
          gte(vesselTrackLog.timestamp, startDate),
          lte(vesselTrackLog.timestamp, endDate)
        )
      );

    // Get first and last positions
    const firstPos = await db
      .select({
        lat: vesselTrackLog.latitude,
        lon: vesselTrackLog.longitude,
      })
      .from(vesselTrackLog)
      .where(
        and(
          eq(vesselTrackLog.orgId, orgId),
          eq(vesselTrackLog.vesselId, vesselId),
          gte(vesselTrackLog.timestamp, startDate),
          lte(vesselTrackLog.timestamp, endDate)
        )
      )
      .orderBy(vesselTrackLog.timestamp)
      .limit(1);

    const lastPos = await db
      .select({
        lat: vesselTrackLog.latitude,
        lon: vesselTrackLog.longitude,
      })
      .from(vesselTrackLog)
      .where(
        and(
          eq(vesselTrackLog.orgId, orgId),
          eq(vesselTrackLog.vesselId, vesselId),
          gte(vesselTrackLog.timestamp, startDate),
          lte(vesselTrackLog.timestamp, endDate)
        )
      )
      .orderBy(sql`${vesselTrackLog.timestamp} DESC`)
      .limit(1);

    const data = stats[0];

    return {
      totalDistanceNm: data?.totalDistance ?? 0,
      avgSpeedKn: data?.avgSpeed ?? 0,
      maxSpeedKn: data?.maxSpeed ?? 0,
      trackPointCount: data?.trackPoints ?? 0,
      startPosition: firstPos[0] ? { lat: firstPos[0].lat, lon: firstPos[0].lon } : null,
      endPosition: lastPos[0] ? { lat: lastPos[0].lat, lon: lastPos[0].lon } : null,
    };
  }
}

export const trackLogService = new TrackLogService();
