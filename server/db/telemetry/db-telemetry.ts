/**
 * Telemetry - Database Storage
 */

import { randomUUID } from "node:crypto";
import { eq, and, gte, lte, sql, type SQL } from "drizzle-orm";
import { tableColumns } from "../_helpers/table-columns";
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
    const conditions: SQL[] = [eq(equipmentTelemetry.equipmentId, equipmentId)];
    if (sensorType) {
      conditions.push(eq(equipmentTelemetry.sensorType, sensorType));
    }
    let query = db
      .select()
      .from(equipmentTelemetry)
      .where(and(...conditions))
      .orderBy(sql`${equipmentTelemetry.ts} DESC`)
      .$dynamic();
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    if (offset !== undefined) {
      query = query.offset(offset);
    }
    return query;
  }
  async getTelemetryByEquipmentAndDateRange(
    equipmentId: string,
    startDate: Date,
    endDate: Date,
    sensorType?: string
  ): Promise<EquipmentTelemetry[]> {
    const conditions: SQL[] = [
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
    const conditions: SQL[] = [
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
    // LR-3.5 / DB-2: deduplicate on the natural composite key
    // (org_id, equipment_id, sensor_type, ts). The supporting UNIQUE
    // index lives in migration 0024. If a duplicate is replayed by
    // the offline outbox or the batch writer's retry path, the
    // ON CONFLICT DO NOTHING short-circuit returns zero rows — we
    // resolve the existing row and hand it back so the caller's
    // contract (always returns the canonical row) is preserved.
    const ts = reading.ts || new Date();
    const insertResult = await db
      .insert(equipmentTelemetry)
      .values({ id: randomUUID(), ...reading, ts })
      .onConflictDoNothing({
        target: [
          equipmentTelemetry.orgId,
          equipmentTelemetry.equipmentId,
          equipmentTelemetry.sensorType,
          equipmentTelemetry.ts,
        ],
      })
      .returning();
    if (insertResult[0]) {
      return insertResult[0];
    }
    // Conflict — return the row that won the race.
    const [existing] = await db
      .select()
      .from(equipmentTelemetry)
      .where(
        and(
          eq(equipmentTelemetry.orgId, reading.orgId),
          eq(equipmentTelemetry.equipmentId, reading.equipmentId),
          eq(equipmentTelemetry.sensorType, reading.sensorType),
          eq(equipmentTelemetry.ts, ts),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new Error("createTelemetryReading: conflict but no existing row found");
    }
    return existing;
  }

  /**
   * Bulk-insert many telemetry readings in a single multi-row statement.
   *
   * LR-3.5 / DB-2: deduplicates on the natural composite key
   * (org_id, equipment_id, sensor_type, ts) via the UNIQUE index in
   * migration 0024. Duplicates replayed by the offline outbox or the
   * batch writer's retry path hit ON CONFLICT DO NOTHING and are
   * silently skipped — they are never fatal.
   *
   * Replaces the per-row `Promise.all(createTelemetryReading(...))` fan-out
   * on the hot ingest path: one round-trip per call instead of one per row.
   * Callers are responsible for chunking to keep each statement within the
   * Postgres bind-parameter limit (see TelemetryBatchWriter.dbInsertChunkSize).
   *
   * Returns the number of rows ACTUALLY inserted (skipped duplicates are
   * excluded), so callers can distinguish attempted vs. persisted rows.
   */
  async createTelemetryReadingsBulk(readings: InsertTelemetry[]): Promise<number> {
    if (readings.length === 0) {
      return 0;
    }
    const values = readings.map((reading) => ({
      id: randomUUID(),
      ...reading,
      ts: reading.ts || new Date(),
    }));
    const inserted = await db
      .insert(equipmentTelemetry)
      .values(values)
      .onConflictDoNothing({
        target: [
          equipmentTelemetry.orgId,
          equipmentTelemetry.equipmentId,
          equipmentTelemetry.sensorType,
          equipmentTelemetry.ts,
        ],
      })
      .returning({ id: equipmentTelemetry.id });
    return inserted.length;
  }
  async getLatestTelemetryReadings(
    equipmentId?: string,
    limit: number = 100,
    vesselId?: string,
    sensorType?: string
  ): Promise<EquipmentTelemetry[]> {
    const conditions: SQL[] = [];
    if (equipmentId) {
      conditions.push(eq(equipmentTelemetry.equipmentId, equipmentId));
    }
    if (vesselId) {
      // SCHEMA GAP: equipmentTelemetry has no vesselId column. Filter is a
      // best-effort lookup against a column that may or may not exist at
      // runtime; bypass the column-type system so callers don't crash.
      const vesselCol = tableColumns(equipmentTelemetry)['vesselId'];
      if (vesselCol) {
        conditions.push(eq(vesselCol, vesselId as never));
      }
    }
    if (sensorType) {
      conditions.push(eq(equipmentTelemetry.sensorType, sensorType));
    }
    let query = db.select().from(equipmentTelemetry).$dynamic();
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    return query.orderBy(sql`${equipmentTelemetry.ts} DESC`).limit(limit);
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
    const conditions: SQL[] = [gte(equipmentTelemetry.ts, cutoff)];
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
      const [eqId = "", sensorType = ""] = key.split(":");
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
    if (!n) {throw new Error("createPdmScore: insert returned no row");}
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
    const hb = heartbeat as InsertHeartbeat & { deviceId: string };
    const e = await this.getHeartbeat(hb.deviceId);
    if (e) {
      const eRow = e as EdgeHeartbeat & { id?: string };
      const idCol = tableColumns(edgeHeartbeats)['id'];
      const [u] = await db
        .update(edgeHeartbeats)
        .set({ ...heartbeat, ts: new Date() } as never)
        .where(eq(idCol as never, eRow.id as never))
        .returning();
      if (!u) {throw new Error("upsertHeartbeat: update returned no row");}
      return u;
    }
    const [n] = await db
      .insert(edgeHeartbeats)
      .values({ id: randomUUID(), ...heartbeat, ts: new Date() } as never)
      .returning();
    if (!n) {throw new Error("upsertHeartbeat: insert returned no row");}
    return n;
  }
}
