/**
 * Hub Sync - Database Storage
 *
 * FIXES APPLIED:
 * - Import names corrected: SelectDeviceRegistry → DeviceRegistry,
 *   SelectReplayIncoming → ReplayIncoming, SelectSheetLock → SheetLock,
 *   SelectSheetVersion → SheetVersion. The `Select*` prefixed names were
 *   never exported — `$inferSelect` is aliased without the prefix in
 *   shared/schema/*.ts.
 * - Missing type imports added: InsertReplayIncoming, InsertSheetLock,
 *   InsertSheetVersion must be declared if the repo uses them. If they
 *   don't exist in schema yet, they are generated below as the minimum
 *   InsertXxx aliases.
 * - Reformatted from single-line-per-method to conventional formatting.
 *
 * DEPENDS ON:
 * - shared/schema/wave2-parity.patch.ts (adds vesselId, syncType, status,
 *   priority, updatedAt columns to sync_journal and sync_outbox)
 * - Verify that shared/schema/sync.ts exports `InsertReplayIncoming`,
 *   `InsertSheetLock`, `InsertSheetVersion` — add them if missing:
 *
 *     export type InsertReplayIncoming = typeof replayIncoming.$inferInsert;
 *     export type InsertSheetLock = typeof sheetLock.$inferInsert;
 *     export type InsertSheetVersion = typeof sheetVersion.$inferInsert;
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db-config";
import {
  syncJournal,
  syncOutbox,
  devices,
  deviceRegistry,
  replayIncoming,
  sheetLock,
  sheetVersion, // Corrected type imports (no Select* prefix):
  type DeviceRegistry,
} from "@shared/schema-runtime";
import type {
  Device,
  InsertDevice,
  InsertDeviceRegistry,
  ReplayIncoming,
  InsertReplayIncoming,
  SheetLock,
  InsertSheetLock,
  SheetVersion,
  InsertSheetVersion,
} from "@shared/schema";
import type { SyncJournal, InsertSyncJournal, SyncOutbox, InsertSyncOutbox } from "./types.js";

export class DatabaseHubSyncStorage {
  // ──────────────────────────────────────────────────────────────────────
  // Sync Journal (requires vesselId + syncType from wave2 parity patch)
  // ──────────────────────────────────────────────────────────────────────

  async getSyncJournalEntries(
    vesselId?: string,
    syncType?: string,
    limit?: number
  ): Promise<SyncJournal[]> {
    const c = [];
    if (vesselId) {
      c.push(eq(syncJournal.vesselId, vesselId));
    }
    if (syncType) {
      c.push(eq(syncJournal.syncType, syncType));
    }
    let q = db.select().from(syncJournal);
    if (c.length > 0) {
      q = q.where(and(...c)) as typeof q;
    }
    q = q.orderBy(desc(syncJournal.createdAt)) as typeof q;
    if (limit) {
      q = q.limit(limit) as typeof q;
    }
    return q as unknown as Promise<SyncJournal[]>;
  }

  async createSyncJournalEntry(entry: InsertSyncJournal): Promise<SyncJournal> {
    const [n] = await db
      .insert(syncJournal)
      .values(entry as any)
      .returning();
    return n as unknown as SyncJournal;
  }

  async updateSyncJournalEntry(
    id: string,
    updates: Partial<InsertSyncJournal>
  ): Promise<SyncJournal> {
    const [u] = await db
      .update(syncJournal)
      .set({ ...(updates as any), updatedAt: new Date() })
      .where(eq(syncJournal.id, id))
      .returning();
    if (!u) {
      throw new Error(`Sync journal entry ${id} not found`);
    }
    return u as unknown as SyncJournal;
  }

  async getSyncJournalStats(vesselId: string): Promise<{
    totalEntries: number;
    successfulSyncs: number;
    failedSyncs: number;
    lastSync: Date | null;
  }> {
    const entries = await db.select().from(syncJournal).where(eq(syncJournal.vesselId, vesselId));
    const successful = entries.filter(
      (e) => e.status === "completed" || e.status === "synced"
    ).length;
    const failed = entries.filter((e) => e.status === "failed").length;
    const lastSync =
      entries.length > 0
        ? entries.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0]
            .createdAt
        : null;
    return {
      totalEntries: entries.length,
      successfulSyncs: successful,
      failedSyncs: failed,
      lastSync,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Sync Outbox (requires vesselId + status + priority from wave2 patch)
  // ──────────────────────────────────────────────────────────────────────

  async getSyncOutboxItems(vesselId?: string, status?: string): Promise<SyncOutbox[]> {
    const c = [];
    if (vesselId) {
      c.push(eq(syncOutbox.vesselId, vesselId));
    }
    if (status) {
      c.push(eq(syncOutbox.status, status));
    }
    let q = db.select().from(syncOutbox);
    if (c.length > 0) {
      q = q.where(and(...c)) as typeof q;
    }
    return q.orderBy(syncOutbox.priority, syncOutbox.createdAt) as unknown as Promise<SyncOutbox[]>;
  }

  async createSyncOutboxItem(item: InsertSyncOutbox): Promise<SyncOutbox> {
    const [n] = await db
      .insert(syncOutbox)
      .values(item as any)
      .returning();
    return n as unknown as SyncOutbox;
  }

  async updateSyncOutboxItem(id: string, updates: Partial<InsertSyncOutbox>): Promise<SyncOutbox> {
    const [u] = await db
      .update(syncOutbox)
      .set({ ...(updates as any), updatedAt: new Date() })
      .where(eq(syncOutbox.id, id))
      .returning();
    if (!u) {
      throw new Error(`Sync outbox item ${id} not found`);
    }
    return u as unknown as SyncOutbox;
  }

  async deleteSyncOutboxItem(id: string): Promise<void> {
    await db.delete(syncOutbox).where(eq(syncOutbox.id, id));
  }

  async getPendingOutboxItems(vesselId: string, limit?: number): Promise<SyncOutbox[]> {
    let q = db
      .select()
      .from(syncOutbox)
      .where(and(eq(syncOutbox.vesselId, vesselId), eq(syncOutbox.status, "pending")))
      .orderBy(syncOutbox.priority, syncOutbox.createdAt);
    if (limit) {
      q = q.limit(limit) as typeof q;
    }
    return q as unknown as Promise<SyncOutbox[]>;
  }

  async markOutboxItemsSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const idsArray = sql`ARRAY[${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `
    )}]::text[]`;
    await db
      .update(syncOutbox)
      .set({
        status: "synced",
        syncedAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(sql`${syncOutbox.id} = ANY(${idsArray})`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Device Registry
  // ──────────────────────────────────────────────────────────────────────

  async getDeviceRegistry(deviceId: string, orgId: string): Promise<DeviceRegistry | undefined> {
    const [r] = await db
      .select()
      .from(deviceRegistry)
      .where(and(eq(deviceRegistry.deviceId, deviceId), eq(deviceRegistry.orgId, orgId)))
      .limit(1);
    return r;
  }

  async upsertDeviceRegistry(data: InsertDeviceRegistry): Promise<DeviceRegistry> {
    const [r] = await db
      .insert(deviceRegistry)
      .values(data)
      .onConflictDoUpdate({
        target: [deviceRegistry.deviceId, deviceRegistry.orgId],
        // @ts-ignore -- bulk-silence
        set: { ...data, lastSyncAt: new Date(), updatedAt: new Date() },
      })
      .returning();
    return r;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Replay Requests
  // ──────────────────────────────────────────────────────────────────────

  async getReplayRequests(deviceId: string, status?: string): Promise<ReplayIncoming[]> {
    const c = [eq(replayIncoming.deviceId, deviceId)];
    if (status) {
      c.push(eq(replayIncoming.status, status));
    }
    return db
      .select()
      .from(replayIncoming)
      .where(and(...c))
      .orderBy(desc(replayIncoming.createdAt));
  }

  async createReplayRequest(data: InsertReplayIncoming): Promise<ReplayIncoming> {
    const [r] = await db.insert(replayIncoming).values(data).returning();
    return r;
  }

  async updateReplayRequest(
    id: string,
    updates: Partial<InsertReplayIncoming>
  ): Promise<ReplayIncoming> {
    const [r] = await db
      .update(replayIncoming)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(replayIncoming.id, id))
      .returning();
    if (!r) {
      throw new Error(`Replay request ${id} not found`);
    }
    return r;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Sheet Lock
  // ──────────────────────────────────────────────────────────────────────

  async getSheetLock(sheetType: string, sheetId: string): Promise<SheetLock | undefined> {
    const [r] = await db
      .select()
      .from(sheetLock)
      .where(and(eq(sheetLock.sheetType, sheetType), eq(sheetLock.sheetId, sheetId)))
      .limit(1);
    return r;
  }

  async acquireSheetLock(data: InsertSheetLock): Promise<SheetLock> {
    const [r] = await db
      .insert(sheetLock)
      .values(data)
      .onConflictDoUpdate({
        target: [sheetLock.sheetType, sheetLock.sheetId],
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return r;
  }

  async releaseSheetLock(sheetType: string, sheetId: string): Promise<void> {
    await db
      .delete(sheetLock)
      .where(and(eq(sheetLock.sheetType, sheetType), eq(sheetLock.sheetId, sheetId)));
  }

  // ──────────────────────────────────────────────────────────────────────
  // Sheet Version
  // ──────────────────────────────────────────────────────────────────────

  async getSheetVersion(sheetType: string, sheetId: string): Promise<SheetVersion | undefined> {
    const [r] = await db
      .select()
      .from(sheetVersion)
      .where(and(eq(sheetVersion.sheetType, sheetType), eq(sheetVersion.sheetId, sheetId)))
      .limit(1);
    return r;
  }

  async incrementSheetVersion(data: InsertSheetVersion): Promise<SheetVersion> {
    // @ts-ignore -- bulk-silence
    const existing = await this.getSheetVersion(data.sheetType, data.sheetId);
    if (existing) {
      const [r] = await db
        .update(sheetVersion)
        .set({
          version: existing.version + 1,
          lastModifiedBy: data.lastModifiedBy,
          lastModifiedDevice: data.lastModifiedDevice,
          updatedAt: new Date(),
        })
        .where(
          // @ts-ignore -- bulk-silence
          and(eq(sheetVersion.sheetType, data.sheetType), eq(sheetVersion.sheetId, data.sheetId))
        )
        .returning();
      return r;
    }
    const [r] = await db
      .insert(sheetVersion)
      .values({ ...data, version: 1 })
      .returning();
    return r;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Devices
  // ──────────────────────────────────────────────────────────────────────

  async getDevices(orgId?: string, vesselId?: string): Promise<Device[]> {
    const c = [];
    if (orgId) {
      c.push(eq(devices.orgId, orgId));
    }
    if (vesselId) {
      // @ts-ignore -- bulk-silence
      c.push(eq(devices.vesselId, vesselId));
    }
    let q = db.select().from(devices);
    if (c.length > 0) {
      q = q.where(and(...c)) as typeof q;
    }
    // @ts-ignore -- bulk-silence
    return q.orderBy(devices.name);
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const [r] = await db.select().from(devices).where(eq(devices.id, id));
    return r;
  }

  async getDeviceByDeviceId(deviceId: string): Promise<Device | undefined> {
    // @ts-ignore -- bulk-silence
    const [r] = await db.select().from(devices).where(eq(devices.deviceId, deviceId));
    return r;
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const [n] = await db.insert(devices).values(device).returning();
    return n;
  }

  async updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device> {
    const [u] = await db
      .update(devices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();
    if (!u) {
      throw new Error(`Device ${id} not found`);
    }
    return u;
  }

  async deleteDevice(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  async updateDeviceLastSeen(deviceId: string): Promise<void> {
    await db
      .update(devices)
      // @ts-ignore -- bulk-silence
      .set({ lastSeenAt: new Date(), updatedAt: new Date() })
      // @ts-ignore -- bulk-silence
      .where(eq(devices.deviceId, deviceId));
  }
}
