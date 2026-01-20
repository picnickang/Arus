/**
 * External Integration Storage Interface - StormGeo, Weather
 * Part of IStorage modularization for improved maintainability
 */

import type {
  StormgeoSetting,
  InsertStormgeoSetting,
  StormgeoSnapshot,
  InsertStormgeoSnapshot,
  StormgeoImportHistory,
  InsertStormgeoImportHistory,
} from "@shared/schema";

/**
 * External integration storage operations for StormGeo and weather data
 */
export interface IExternalStorage {
  // StormGeo Settings
  getStormgeoSettings(orgId: string, vesselId?: string): Promise<StormgeoSetting | undefined>;
  createStormgeoSettings(settings: InsertStormgeoSetting): Promise<StormgeoSetting>;
  updateStormgeoSettings(id: string, settings: Partial<InsertStormgeoSetting>, orgId: string): Promise<StormgeoSetting>;
  deleteStormgeoSettings(id: string, orgId: string): Promise<void>;

  // StormGeo Snapshots
  getStormgeoSnapshots(orgId: string, filters?: { vesselId?: string; snapshotType?: string; routeId?: string; forecastTimeStart?: Date; forecastTimeEnd?: Date }): Promise<StormgeoSnapshot[]>;
  getStormgeoSnapshotById(id: string, orgId: string): Promise<StormgeoSnapshot | undefined>;
  getStormgeoSnapshotForTime(vesselId: string, forecastTime: Date, orgId: string): Promise<StormgeoSnapshot | undefined>;
  createStormgeoSnapshot(snapshot: InsertStormgeoSnapshot): Promise<StormgeoSnapshot>;
  bulkCreateStormgeoSnapshots(snapshots: InsertStormgeoSnapshot[]): Promise<StormgeoSnapshot[]>;
  deleteStormgeoSnapshot(id: string, orgId: string): Promise<void>;
  deleteStormgeoSnapshotsByRoute(routeId: string, orgId: string): Promise<void>;

  // StormGeo Import History
  getStormgeoImportHistory(orgId: string, filters?: { vesselId?: string; status?: string; limit?: number }): Promise<StormgeoImportHistory[]>;
  getStormgeoImportHistoryById(id: string, orgId: string): Promise<StormgeoImportHistory | undefined>;
  createStormgeoImportHistory(history: InsertStormgeoImportHistory): Promise<StormgeoImportHistory>;
  updateStormgeoImportHistory(id: string, history: Partial<InsertStormgeoImportHistory>, orgId: string): Promise<StormgeoImportHistory>;
}
