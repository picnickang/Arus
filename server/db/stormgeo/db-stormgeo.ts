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
    let q = db.select().from(stormgeoSettings);
    if (c.length > 0) {
      // @ts-ignore -- bulk-silence
      q = q.where(and(...c));
    }
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
      // @ts-ignore -- bulk-silence
      c.push(gte(stormgeoSnapshots.timestamp, fromDate));
    }
    if (toDate) {
      // @ts-ignore -- bulk-silence
      c.push(lte(stormgeoSnapshots.timestamp, toDate));
    }
    let q = db.select().from(stormgeoSnapshots);
    if (c.length > 0) {
      // @ts-ignore -- bulk-silence
      q = q.where(and(...c));
    }
    // @ts-ignore -- bulk-silence
    return q.orderBy(sql`${stormgeoSnapshots.timestamp} DESC`);
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
      // @ts-ignore -- bulk-silence
      .orderBy(sql`${stormgeoSnapshots.timestamp} DESC`)
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
    // @ts-ignore -- bulk-silence
    const r = await db.delete(stormgeoSnapshots).where(lte(stormgeoSnapshots.timestamp, date));
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
    let q = db.select().from(stormgeoImportHistory);
    if (c.length > 0) {
      // @ts-ignore -- bulk-silence
      q = q.where(and(...c));
    }
    // @ts-ignore -- bulk-silence
    return q.orderBy(sql`${stormgeoImportHistory.importedAt} DESC`);
  }
  async createStormgeoImportHistory(
    entry: InsertStormgeoImportHistory
  ): Promise<StormgeoImportHistory> {
    const [n] = await db.insert(stormgeoImportHistory).values(entry).returning();
    return n;
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
    let q = db.select().from(weatherCache);
    if (c.length > 0) {
      // @ts-ignore -- bulk-silence
      q = q.where(and(...c));
    }
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
