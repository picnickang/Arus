/**
 * StormGeo Integration Service - Main Class
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:Stormgeo:Service");
import { dbStormGeoStorage } from "../../repositories";
import type {
  StormgeoSettings as StormgeoSetting,
  InsertStormgeoSettings as InsertStormgeoSetting,
  StormgeoSnapshot,
  StormgeoImportHistory,
  InsertStormgeoSnapshot,
  DeckLogHourly,
} from "@shared/schema";
import { createHash } from "node:crypto";
import type { StormGeoJSONFormat } from "./types.js";
import { bearingToDirection, windSpeedToBeaufort, waveHeightToSeaState } from "./converters.js";
import { parseCSV, csvRowToSnapshot, jsonWaypointToSnapshot } from "./parsers.js";

export class StormGeoIntegrationService {
  constructor() {
    logger.info("[StormGeo] Integration service initialized");
  }

  async getSettings(orgId: string, vesselId?: string): Promise<StormgeoSetting | undefined> {
    return dbStormGeoStorage.getStormgeoSettings(orgId, vesselId);
  }

  async upsertSettings(settings: InsertStormgeoSetting): Promise<StormgeoSetting> {
    const existing = await dbStormGeoStorage.getStormgeoSettings(
      settings.orgId,
      settings.vesselId || undefined
    );
    if (existing) {
      return dbStormGeoStorage.updateStormgeoSetting(existing.id, settings, settings.orgId);
    }
    return dbStormGeoStorage.createStormgeoSetting(settings);
  }

  async importCSV(
    orgId: string,
    vesselId: string,
    fileContent: string,
    fileName: string,
    initiatedBy?: string
  ): Promise<StormgeoImportHistory> {
    const startTime = Date.now(),
      fileHash = createHash("sha256").update(fileContent).digest("hex");
    const importRecord = await dbStormGeoStorage.createStormgeoImportHistory({
      orgId,
      vesselId,
      importType: "file",
      fileName,
      fileSize: Buffer.byteLength(fileContent, "utf8"),
      fileHash,
      status: "processing",
      startedAt: new Date(),
      initiatedBy: initiatedBy || "system",
    });

    try {
      const rows = parseCSV(fileContent);
      const snapshots: InsertStormgeoSnapshot[] = [],
        errors: Array<{ row: number; field?: string; error: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        try {
          snapshots.push(csvRowToSnapshot(rows[i], orgId, vesselId, fileName));
        } catch (error) {
          errors.push({
            row: i + 2,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      if (snapshots.length > 0) {
        await dbStormGeoStorage.createStormgeoSnapshot(snapshots);
      }
      const status = errors.length === 0 ? "success" : snapshots.length > 0 ? "partial" : "failed";
      return dbStormGeoStorage.createStormgeoImportHistory(
        importRecord.id,
        {
          status,
          recordsProcessed: rows.length,
          recordsCreated: snapshots.length,
          recordsFailed: errors.length,
          errorDetails: errors.length > 0 ? errors : undefined,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
        orgId
      );
    } catch (error) {
      return dbStormGeoStorage.createStormgeoImportHistory(
        importRecord.id,
        {
          status: "failed",
          errorDetails: [
            { row: 0, error: error instanceof Error ? error.message : "Import failed" },
          ],
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
        orgId
      );
    }
  }

  async importJSON(
    orgId: string,
    vesselId: string,
    fileContent: string,
    fileName: string,
    initiatedBy?: string
  ): Promise<StormgeoImportHistory> {
    const startTime = Date.now(),
      fileHash = createHash("sha256").update(fileContent).digest("hex");
    const importRecord = await dbStormGeoStorage.createStormgeoImportHistory({
      orgId,
      vesselId,
      importType: "file",
      fileName,
      fileSize: Buffer.byteLength(fileContent, "utf8"),
      fileHash,
      status: "processing",
      startedAt: new Date(),
      initiatedBy: initiatedBy || "system",
    });

    try {
      const data: StormGeoJSONFormat = JSON.parse(fileContent);
      const snapshots: InsertStormgeoSnapshot[] = [],
        errors: Array<{ row: number; field?: string; error: string }> = [];

      for (let i = 0; i < data.waypoints.length; i++) {
        try {
          snapshots.push(
            jsonWaypointToSnapshot(
              data.waypoints[i],
              orgId,
              vesselId,
              fileName,
              data.route_id,
              data.route_name,
              data.departure_port,
              data.arrival_port,
              data.departure_time,
              data.arrival_time
            )
          );
        } catch (error) {
          errors.push({
            row: i + 1,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      if (snapshots.length > 0) {
        await dbStormGeoStorage.createStormgeoSnapshot(snapshots);
      }
      const status = errors.length === 0 ? "success" : snapshots.length > 0 ? "partial" : "failed";
      return dbStormGeoStorage.createStormgeoImportHistory(
        importRecord.id,
        {
          status,
          recordsProcessed: data.waypoints.length,
          recordsCreated: snapshots.length,
          recordsFailed: errors.length,
          errorDetails: errors.length > 0 ? errors : undefined,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
        orgId
      );
    } catch (error) {
      return dbStormGeoStorage.createStormgeoImportHistory(
        importRecord.id,
        {
          status: "failed",
          errorDetails: [
            { row: 0, error: error instanceof Error ? error.message : "Import failed" },
          ],
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
        orgId
      );
    }
  }

  async getWeatherForTime(
    vesselId: string,
    targetTime: Date,
    orgId: string
  ): Promise<StormgeoSnapshot | undefined> {
    return dbStormGeoStorage.getStormgeoSnapshot(vesselId, targetTime, orgId);
  }

  async autoFillHourlyEntry(
    vesselId: string,
    logDate: string,
    hour: number,
    orgId: string
  ): Promise<{ fields: Partial<DeckLogHourly>; source: string; snapshotId?: string } | null> {
    const targetTime = new Date(`${logDate}T${hour.toString().padStart(2, "0")}:00:00Z`);
    const snapshot = await this.getWeatherForTime(vesselId, targetTime, orgId);
    if (snapshot) {
      return {
        fields: {
          windDirection: snapshot.windDirection
            ? bearingToDirection(snapshot.windDirection)
            : undefined,
          windForce:
            snapshot.windForceBeaufort ??
            (snapshot.windSpeed ? windSpeedToBeaufort(snapshot.windSpeed) : undefined),
          seaState:
            snapshot.seaState ??
            (snapshot.waveHeight ? waveHeightToSeaState(snapshot.waveHeight) : undefined),
          swellDirection: snapshot.swellDirection
            ? bearingToDirection(snapshot.swellDirection)
            : undefined,
          swellHeight: snapshot.swellHeight ?? undefined,
          barometer: snapshot.barometer ?? undefined,
          airTemperature: snapshot.airTemperature ?? undefined,
          seaTemperature: snapshot.seaTemperature ?? undefined,
          visibility: snapshot.visibility ? Math.round(snapshot.visibility) : undefined,
          skyCondition: snapshot.skyCondition ?? undefined,
          humidity: snapshot.humidity ?? undefined,
          latitude: snapshot.latitude ?? undefined,
          longitude: snapshot.longitude ?? undefined,
        },
        source: "stormgeo",
        snapshotId: snapshot.id,
      };
    }
    return null;
  }

  async recordAutoFill(
    hourlyLogId: string,
    source: string,
    snapshotId: string | undefined,
    autoFilledFields: string[],
    confidenceScore?: number
  ): Promise<void> {
    await dbStormGeoStorage.createDeckLogHourlyAutoFill({
      hourlyLogId,
      source,
      snapshotId: snapshotId || null,
      autoFilledFields,
      confidenceScore: confidenceScore ?? 0.9,
      dataQuality: confidenceScore && confidenceScore > 0.8 ? "high" : "medium",
    });
  }

  async getImportHistory(
    orgId: string,
    vesselId?: string,
    limit?: number
  ): Promise<StormgeoImportHistory[]> {
    return dbStormGeoStorage.getStormgeoImportHistory(orgId, { vesselId, limit });
  }

  async getSnapshots(
    orgId: string,
    vesselId: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<StormgeoSnapshot[]> {
    return dbStormGeoStorage.getStormgeoSnapshots(orgId, {
      vesselId,
      forecastTimeStart: startTime,
      forecastTimeEnd: endTime,
    });
  }
}

export const stormgeoIntegrationService = new StormGeoIntegrationService();
