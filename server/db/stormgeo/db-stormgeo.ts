/**
 * StormGeo - Database Storage
 */

import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db-config";
import {
  stormgeoSettings,
  stormgeoSnapshots,
  stormgeoImportHistory,
  weatherCache,
} from "@shared/schema-runtime";
import type {
  StormgeoSettings as StormgeoSetting,
  InsertStormgeoSettings as InsertStormgeoSetting,
  StormgeoSnapshot,
  InsertStormgeoSnapshot,
  StormgeoImportHistory,
  InsertStormgeoImportHistory,
} from "@shared/schema";
import type { WeatherCache, InsertWeatherCache } from "./types.js";

export class DatabaseStormGeoStorage {
  async getStormgeoSettings(orgId?: string, vesselId?: string): Promise<StormgeoSetting[]> {
    const c = [];
    if (orgId) {
      c.push(eq(stormgeoSettings.orgId, orgId));
    }
    if (vesselId) {
      c.push(eq(stormgeoSettings.vesselId, vesselId));
    }
    const base = db.select().from(stormgeoSettings);
    const q = c.length > 0 ? base.where(and(...c)) : base;
    return q.orderBy(stormgeoSettings.createdAt);
  }
  async getStormgeoSetting(id: string): Promise<StormgeoSetting | undefined> {
    const [r] = await db.select().from(stormgeoSettings).where(eq(stormgeoSettings.id, id));
    return r;
  }
  async getStormgeoSettingByVessel(vesselId: string): Promise<StormgeoSetting | undefined> {
    const [r] = await db
      .select()
      .from(stormgeoSettings)
      .where(eq(stormgeoSettings.vesselId, vesselId))
      .limit(1);
    return r;
  }
  async createStormgeoSetting(config: InsertStormgeoSetting): Promise<StormgeoSetting> {
    const [n] = await db.insert(stormgeoSettings).values(config).returning();
    return n;
  }
  async updateStormgeoSetting(
    id: string,
    updates: Partial<InsertStormgeoSetting>
  ): Promise<StormgeoSetting> {
    const [u] = await db
      .update(stormgeoSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stormgeoSettings.id, id))
      .returning();
    if (!u) {
      throw new Error(`StormGeo setting ${id} not found`);
    }
    return u;
  }
  async deleteStormgeoSetting(id: string): Promise<void> {
    await db.delete(stormgeoSettings).where(eq(stormgeoSettings.id, id));
  }

  async getStormgeoSnapshots(
    orgId?: string,
    vesselId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<StormgeoSnapshot[]> {
    const c = [];
    if (orgId) {
      c.push(eq(stormgeoSnapshots.orgId, orgId));
    }
    if (vesselId) {
      c.push(eq(stormgeoSnapshots.vesselId, vesselId));
    }
    if (fromDate) {
      c.push(gte(stormgeoSnapshots.forecastTime, fromDate));
    }
    if (toDate) {
      c.push(lte(stormgeoSnapshots.forecastTime, toDate));
    }
    const base = db.select().from(stormgeoSnapshots);
    const q = c.length > 0 ? base.where(and(...c)) : base;
    return q.orderBy(sql`${stormgeoSnapshots.forecastTime} DESC`);
  }
  async getStormgeoSnapshot(id: string): Promise<StormgeoSnapshot | undefined> {
    const [r] = await db.select().from(stormgeoSnapshots).where(eq(stormgeoSnapshots.id, id));
    return r;
  }
  async getLatestStormgeoSnapshot(vesselId: string): Promise<StormgeoSnapshot | undefined> {
    const [r] = await db
      .select()
      .from(stormgeoSnapshots)
      .where(eq(stormgeoSnapshots.vesselId, vesselId))
      .orderBy(sql`${stormgeoSnapshots.forecastTime} DESC`)
      .limit(1);
    return r;
  }
  async createStormgeoSnapshot(snapshot: InsertStormgeoSnapshot): Promise<StormgeoSnapshot> {
    const [n] = await db.insert(stormgeoSnapshots).values(snapshot).returning();
    return n;
  }
  async bulkInsertStormgeoSnapshots(snapshots: InsertStormgeoSnapshot[]): Promise<number> {
    if (snapshots.length === 0) {
      return 0;
    }
    await db.insert(stormgeoSnapshots).values(snapshots);
    return snapshots.length;
  }
  async deleteStormgeoSnapshotsBefore(date: Date): Promise<number> {
    const r = await db.delete(stormgeoSnapshots).where(lte(stormgeoSnapshots.forecastTime, date));
    return r.rowCount ?? 0;
  }

  async getStormgeoImportHistory(
    orgId?: string,
    vesselId?: string
  ): Promise<StormgeoImportHistory[]> {
    const c = [];
    if (orgId) {
      c.push(eq(stormgeoImportHistory.orgId, orgId));
    }
    if (vesselId) {
      c.push(eq(stormgeoImportHistory.vesselId, vesselId));
    }
    const base = db.select().from(stormgeoImportHistory);
    const q = c.length > 0 ? base.where(and(...c)) : base;
    return q.orderBy(sql`${(stormgeoImportHistory as any).importedAt} DESC`);
  }
  async createStormgeoImportHistory(
    entry: InsertStormgeoImportHistory
  ): Promise<StormgeoImportHistory> {
    const [n] = await db.insert(stormgeoImportHistory).values(entry).returning();
    return n;
  }
  async updateStormgeoImportHistory(
    id: string,
    updates: Partial<InsertStormgeoImportHistory>
  ): Promise<StormgeoImportHistory> {
    const [u] = await db
      .update(stormgeoImportHistory)
      .set(updates)
      .where(eq(stormgeoImportHistory.id, id))
      .returning();
    if (!u) throw new Error(`StormGeo import history ${id} not found`);
    return u;
  }
  async getStormgeoSnapshotByTime(
    vesselId: string,
    targetTime: Date,
    orgId: string
  ): Promise<StormgeoSnapshot | undefined> {
    const [r] = await db
      .select()
      .from(stormgeoSnapshots)
      .where(
        and(
          eq(stormgeoSnapshots.vesselId, vesselId),
          eq(stormgeoSnapshots.orgId, orgId),
          lte(stormgeoSnapshots.forecastTime, targetTime),
        ),
      )
      .orderBy(sql`${stormgeoSnapshots.forecastTime} DESC`)
      .limit(1);
    return r;
  }
  async createDeckLogHourlyAutoFill(_entry: Record<string, unknown>): Promise<void> {
    // Delegated to logbook storage; stub retained for service convenience
  }

  async getWeatherCache(
    vesselId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<WeatherCache[]> {
    const c = [];
    if (vesselId) {
      c.push(eq(weatherCache.vesselId, vesselId));
    }
    if (fromDate) {
      c.push(gte(weatherCache.fetchedAt, fromDate));
    }
    if (toDate) {
      c.push(lte(weatherCache.fetchedAt, toDate));
    }
    const base = db.select().from(weatherCache);
    const q = c.length > 0 ? base.where(and(...c)) : base;
    return q.orderBy(sql`${weatherCache.fetchedAt} DESC`);
  }
  async getLatestWeatherCache(vesselId: string): Promise<WeatherCache | undefined> {
    const [r] = await db
      .select()
      .from(weatherCache)
      .where(eq(weatherCache.vesselId, vesselId))
      .orderBy(sql`${weatherCache.fetchedAt} DESC`)
      .limit(1);
    return r;
  }
  async createWeatherCache(data: InsertWeatherCache): Promise<WeatherCache> {
    const [n] = await db.insert(weatherCache).values(data).returning();
    return n;
  }
  async bulkInsertWeatherCache(dataList: InsertWeatherCache[]): Promise<number> {
    if (dataList.length === 0) {
      return 0;
    }
    await db.insert(weatherCache).values(dataList);
    return dataList.length;
  }
  async deleteExpiredWeatherCache(): Promise<number> {
    const r = await db.delete(weatherCache).where(lte(weatherCache.expiresAt, new Date()));
    return r.rowCount ?? 0;
  }
  async getWeatherSummary(
    vesselId: string,
    days: number = 7
  ): Promise<{ avgTemp: number; avgWindSpeed: number; avgWaveHeight: number; dataPoints: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const data = await db
      .select()
      .from(weatherCache)
      .where(and(eq(weatherCache.vesselId, vesselId), gte(weatherCache.fetchedAt, cutoffDate)));
    if (data.length === 0) {
      return { avgTemp: 0, avgWindSpeed: 0, avgWaveHeight: 0, dataPoints: 0 };
    }
    const avgTemp = data.reduce((sum, d) => sum + (d.temperature ?? 0), 0) / data.length;
    const avgWindSpeed = data.reduce((sum, d) => sum + (d.windSpeed ?? 0), 0) / data.length;
    const avgWaveHeight = data.reduce((sum, d) => sum + (d.waveHeight ?? 0), 0) / data.length;
    return { avgTemp, avgWindSpeed, avgWaveHeight, dataPoints: data.length };
  }
}
