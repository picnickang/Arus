import { eq, sql, and, lt, desc } from "drizzle-orm";
import { db } from "../../db-config";
import { equipmentHeartbeat, type EquipmentHeartbeat } from "@shared/schema/telemetry";
import { logger } from "../../utils/logger";
import client from "prom-client";

const heartbeatUpdatesTotal = new client.Counter({
  name: "arus_equipment_heartbeat_updates_total",
  help: "Total equipment heartbeat updates",
  labelNames: ["status"],
});

const equipmentOnlineGauge = new client.Gauge({
  name: "arus_equipment_online_count",
  help: "Number of online equipment",
  labelNames: ["org_id"],
});

const equipmentOfflineGauge = new client.Gauge({
  name: "arus_equipment_offline_count",
  help: "Number of offline equipment",
  labelNames: ["org_id"],
});

export interface HeartbeatUpdate {
  equipmentId: string;
  orgId: string;
  signalType?: string;
  value?: number;
  protocol?: string;
  source?: string;
}

export class EquipmentHeartbeatAdapter {
  private readonly onlineThresholdMs: number;

  constructor(onlineThresholdMs: number = 5 * 60 * 1000) {
    this.onlineThresholdMs = onlineThresholdMs;
  }

  async updateHeartbeat(update: HeartbeatUpdate): Promise<void> {
    const now = new Date();

    try {
      await db
        .insert(equipmentHeartbeat)
        .values({
          equipmentId: update.equipmentId,
          orgId: update.orgId,
          lastSeenAt: now,
          lastSignalType: update.signalType,
          lastValue: update.value,
          onlineStatus: "online",
          lastProtocol: update.protocol,
          lastSource: update.source,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: equipmentHeartbeat.equipmentId,
          set: {
            lastSeenAt: now,
            lastSignalType: update.signalType ?? sql`${equipmentHeartbeat.lastSignalType}`,
            lastValue: update.value ?? sql`${equipmentHeartbeat.lastValue}`,
            onlineStatus: "online",
            lastProtocol: update.protocol ?? sql`${equipmentHeartbeat.lastProtocol}`,
            lastSource: update.source ?? sql`${equipmentHeartbeat.lastSource}`,
            signalCount24h: sql`COALESCE(${equipmentHeartbeat.signalCount24h}, 0) + 1`,
            updatedAt: now,
          },
        });

      heartbeatUpdatesTotal.inc({ status: "success" });
    } catch (error) {
      heartbeatUpdatesTotal.inc({ status: "error" });
      logger.error("EquipmentHeartbeat", "Failed to update heartbeat", {
        equipmentId: update.equipmentId,
        error,
      });
      throw error;
    }
  }

  async batchUpdateHeartbeats(updates: HeartbeatUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    const uniqueUpdates = new Map<string, HeartbeatUpdate>();
    for (const update of updates) {
      const existing = uniqueUpdates.get(update.equipmentId);
      if (!existing) {
        uniqueUpdates.set(update.equipmentId, update);
      }
    }

    for (const update of Array.from(uniqueUpdates.values())) {
      await this.updateHeartbeat(update);
    }
  }

  async getHeartbeat(equipmentId: string): Promise<EquipmentHeartbeat | undefined> {
    const [row] = await db
      .select()
      .from(equipmentHeartbeat)
      .where(eq(equipmentHeartbeat.equipmentId, equipmentId));
    return row;
  }

  async getOfflineEquipment(orgId: string, thresholdMs?: number): Promise<EquipmentHeartbeat[]> {
    const threshold = thresholdMs ?? this.onlineThresholdMs;
    const cutoff = new Date(Date.now() - threshold);

    return db
      .select()
      .from(equipmentHeartbeat)
      .where(and(eq(equipmentHeartbeat.orgId, orgId), lt(equipmentHeartbeat.lastSeenAt, cutoff)))
      .orderBy(desc(equipmentHeartbeat.lastSeenAt));
  }

  async getOnlineEquipment(orgId: string, thresholdMs?: number): Promise<EquipmentHeartbeat[]> {
    const threshold = thresholdMs ?? this.onlineThresholdMs;
    const cutoff = new Date(Date.now() - threshold);

    return db
      .select()
      .from(equipmentHeartbeat)
      .where(
        and(eq(equipmentHeartbeat.orgId, orgId), sql`${equipmentHeartbeat.lastSeenAt} >= ${cutoff}`)
      )
      .orderBy(desc(equipmentHeartbeat.lastSeenAt));
  }

  async updateOnlineStatus(): Promise<{ online: number; offline: number; stale: number }> {
    const cutoff = new Date(Date.now() - this.onlineThresholdMs);
    const staleCutoff = new Date(Date.now() - this.onlineThresholdMs * 6);

    await db
      .update(equipmentHeartbeat)
      .set({ onlineStatus: "online", updatedAt: new Date() })
      .where(sql`${equipmentHeartbeat.lastSeenAt} >= ${cutoff}`);

    await db
      .update(equipmentHeartbeat)
      .set({ onlineStatus: "offline", updatedAt: new Date() })
      .where(
        and(
          lt(equipmentHeartbeat.lastSeenAt, cutoff),
          sql`${equipmentHeartbeat.lastSeenAt} >= ${staleCutoff}`
        )
      );

    await db
      .update(equipmentHeartbeat)
      .set({ onlineStatus: "stale", updatedAt: new Date() })
      .where(lt(equipmentHeartbeat.lastSeenAt, staleCutoff));

    const statusCounts = await db
      .select({
        status: equipmentHeartbeat.onlineStatus,
        count: sql<number>`count(*)`,
      })
      .from(equipmentHeartbeat)
      .groupBy(equipmentHeartbeat.onlineStatus);

    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      counts[row.status] = Number(row.count);
    }

    return {
      online: counts["online"] ?? 0,
      offline: counts["offline"] ?? 0,
      stale: counts["stale"] ?? 0,
    };
  }

  async resetDailySignalCounts(): Promise<void> {
    await db.update(equipmentHeartbeat).set({ signalCount24h: 0, updatedAt: new Date() });

    logger.info("EquipmentHeartbeat", "Reset daily signal counts");
  }

  async getMetricsByOrg(orgId: string): Promise<{
    total: number;
    online: number;
    offline: number;
    stale: number;
    avgLatencyMs: number | null;
  }> {
    const statusCounts = await db
      .select({
        status: equipmentHeartbeat.onlineStatus,
        count: sql<number>`count(*)`,
        avgLatency: sql<number>`avg(${equipmentHeartbeat.avgLatencyMs})`,
      })
      .from(equipmentHeartbeat)
      .where(eq(equipmentHeartbeat.orgId, orgId))
      .groupBy(equipmentHeartbeat.onlineStatus);

    const counts: Record<string, number> = {};
    let totalLatency = 0;
    let latencyCount = 0;

    for (const row of statusCounts) {
      counts[row.status] = Number(row.count);
      if (row.avgLatency) {
        totalLatency += row.avgLatency * Number(row.count);
        latencyCount += Number(row.count);
      }
    }

    const online = counts["online"] ?? 0;
    const offline = counts["offline"] ?? 0;
    const stale = counts["stale"] ?? 0;

    equipmentOnlineGauge.set({ org_id: orgId }, online);
    equipmentOfflineGauge.set({ org_id: orgId }, offline + stale);

    return {
      total: online + offline + stale,
      online,
      offline,
      stale,
      avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : null,
    };
  }
}

export const equipmentHeartbeatAdapter = new EquipmentHeartbeatAdapter();
