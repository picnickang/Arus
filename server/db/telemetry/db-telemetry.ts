/**
 * Telemetry - Database Storage
 */

import { randomUUID } from "node:crypto";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { equipmentTelemetry, pdmScoreLogs, edgeHeartbeats } from "@shared/schema-runtime";
import type {
  EquipmentTelemetry,
  InsertTelemetry,
  PdmScoreLog,
  InsertPdmScoreLog as InsertPdmScore,
  EdgeHeartbeat,
  InsertEquipmentHeartbeat as InsertHeartbeat,
} from "@shared/schema";
import type { TelemetryTrend } from "./types.js";

export class DatabaseTelemetryStorage {
  private validateOrgId(orgId: string | undefined, method: string): void {
    if (!orgId) {
      throw new Error(`[${method}] orgId is required`);
    }
  }

  async getTelemetryHistory(
    equipmentId: string,
    sensorType?: string,
    limit?: number,
    offset?: number
  ): Promise<EquipmentTelemetry[]> {
    const conditions: any[] = [eq(equipmentTelemetry.equipmentId, equipmentId)];
    if (sensorType) {
      conditions.push(eq(equipmentTelemetry.sensorType, sensorType));
    }
    let query = db
      .select()
      .from(equipmentTelemetry)
      .where(and(...conditions))
      .orderBy(sql`${equipmentTelemetry.ts} DESC`);
    if (limit !== undefined) {
      query = query.limit(limit) as any;
    }
    if (offset !== undefined) {
      query = query.offset(offset) as any;
    }
    return query;
  }
  async getTelemetryByEquipmentAndDateRange(
    equipmentId: string,
    startDate: Date,
    endDate: Date,
    sensorType?: string
  ): Promise<EquipmentTelemetry[]> {
    const conditions: any[] = [
      eq(equipmentTelemetry.equipmentId, equipmentId),
      gte(equipmentTelemetry.ts, startDate),
      lte(equipmentTelemetry.ts, endDate),
    ];
    if (sensorType) {
      conditions.push(eq(equipmentTelemetry.sensorType, sensorType));
    }
    return db
      .select()
      .from(equipmentTelemetry)
      .where(and(...conditions))
      .orderBy(equipmentTelemetry.ts);
  }
  async getTelemetryByDateRange(
    startDate: Date,
    endDate: Date,
    orgId?: string
  ): Promise<EquipmentTelemetry[]> {
    const conditions: any[] = [
      gte(equipmentTelemetry.ts, startDate),
      lte(equipmentTelemetry.ts, endDate),
    ];
    if (orgId) {
      conditions.push(eq(equipmentTelemetry.orgId, orgId));
    }
    return db
      .select()
      .from(equipmentTelemetry)
      .where(and(...conditions))
      .orderBy(equipmentTelemetry.ts)
      .limit(10000);
  }
  async createTelemetryReading(reading: InsertTelemetry): Promise<EquipmentTelemetry> {
    const [n] = await db
      .insert(equipmentTelemetry)
      .values({ id: randomUUID(), ...reading, ts: reading.ts || new Date() })
      .returning();
    return n;
  }
  async getLatestTelemetryReadings(
    equipmentId?: string,
    limit: number = 100,
    vesselId?: string,
    sensorType?: string
  ): Promise<EquipmentTelemetry[]> {
    const conditions: any[] = [];
    if (equipmentId) {
      conditions.push(eq(equipmentTelemetry.equipmentId, equipmentId));
    }
    if (vesselId) {
      // @ts-ignore -- bulk-silence
      conditions.push(eq(equipmentTelemetry.vesselId, vesselId));
    }
    if (sensorType) {
      conditions.push(eq(equipmentTelemetry.sensorType, sensorType));
    }
    let query = db.select().from(equipmentTelemetry);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    return (query as any).orderBy(sql`${equipmentTelemetry.ts} DESC`).limit(limit);
  }
  async getLatestTelemetryForSensor(
    equipmentId: string,
    sensorType: string
  ): Promise<EquipmentTelemetry | undefined> {
    const [result] = await db
      .select()
      .from(equipmentTelemetry)
      .where(
        and(
          eq(equipmentTelemetry.equipmentId, equipmentId),
          eq(equipmentTelemetry.sensorType, sensorType)
        )
      )
      .orderBy(sql`${equipmentTelemetry.ts} DESC`)
      .limit(1);
    return result;
  }
  async getLatestTelemetryForSensors(
    equipmentId: string,
    sensorTypes: string[]
  ): Promise<Map<string, EquipmentTelemetry>> {
    const result = new Map<string, EquipmentTelemetry>();
    for (const sensorType of sensorTypes) {
      const latest = await this.getLatestTelemetryForSensor(equipmentId, sensorType);
      if (latest) {
        result.set(sensorType, latest);
      }
    }
    return result;
  }
  async getTelemetryTrends(equipmentId?: string, hours: number = 24): Promise<TelemetryTrend[]> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    const conditions: any[] = [gte(equipmentTelemetry.ts, cutoff)];
    if (equipmentId) {
      conditions.push(eq(equipmentTelemetry.equipmentId, equipmentId));
    }
    const readings = await db
      .select()
      .from(equipmentTelemetry)
      .where(and(...conditions));
    const grouped = new Map<string, EquipmentTelemetry[]>();
    for (const r of readings) {
      const key = `${r.equipmentId}:${r.sensorType}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(r);
    }
    const trends: TelemetryTrend[] = [];
    for (const [key, group] of grouped) {
      const [eqId, sensorType] = key.split(":");
      const values = group.map((r) => r.value ?? 0);
      trends.push({
        equipmentId: eqId,
        sensorType,
        avgValue: values.reduce((a, b) => a + b, 0) / values.length,
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
        dataPoints: values.length,
        lastReading: new Date(Math.max(...group.map((r) => r.ts?.getTime() ?? 0))),
      });
    }
    return trends;
  }

  async clearOrphanedTelemetryData(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await db.delete(equipmentTelemetry).where(lte(equipmentTelemetry.ts, thirtyDaysAgo));
  }

  async getPdmScores(equipmentId?: string): Promise<PdmScoreLog[]> {
    if (equipmentId) {
      return db
        .select()
        .from(pdmScoreLogs)
        .where(eq(pdmScoreLogs.equipmentId, equipmentId))
        .orderBy(sql`${pdmScoreLogs.ts} DESC`);
    }
    return db
      .select()
      .from(pdmScoreLogs)
      .orderBy(sql`${pdmScoreLogs.ts} DESC`);
  }
  async createPdmScore(score: InsertPdmScore): Promise<PdmScoreLog> {
    const [n] = await db
      .insert(pdmScoreLogs)
      .values({ id: randomUUID(), ts: new Date(), ...score })
      .returning();
    return n;
  }
  async getLatestPdmScore(equipmentId: string): Promise<PdmScoreLog | undefined> {
    const [result] = await db
      .select()
      .from(pdmScoreLogs)
      .where(eq(pdmScoreLogs.equipmentId, equipmentId))
      .orderBy(sql`${pdmScoreLogs.ts} DESC`)
      .limit(1);
    return result;
  }

  async getHeartbeats(): Promise<EdgeHeartbeat[]> {
    return db
      .select()
      .from(edgeHeartbeats)
      .orderBy(sql`${edgeHeartbeats.ts} DESC`);
  }
  async getHeartbeat(deviceId: string): Promise<EdgeHeartbeat | undefined> {
    const [result] = await db
      .select()
      .from(edgeHeartbeats)
      .where(eq(edgeHeartbeats.deviceId, deviceId));
    return result;
  }
  async upsertHeartbeat(heartbeat: InsertHeartbeat): Promise<EdgeHeartbeat> {
    // @ts-ignore -- bulk-silence
    const e = await this.getHeartbeat(heartbeat.deviceId);
    if (e) {
      const [u] = await db
        .update(edgeHeartbeats)
        .set({ ...heartbeat, ts: new Date() })
        // @ts-ignore -- bulk-silence
        .where(eq(edgeHeartbeats.id, e.id))
        .returning();
      return u;
    }
    const [n] = await db
      .insert(edgeHeartbeats)
      // @ts-ignore -- bulk-silence
      .values({ id: randomUUID(), ...heartbeat, ts: new Date() })
      .returning();
    return n;
  }
}
