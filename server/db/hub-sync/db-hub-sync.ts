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
    let q = db.select().from(syncJournal).$dynamic();
    if (c.length > 0) {
      q = q.where(and(...c));
    }
    q = q.orderBy(desc(syncJournal.createdAt));
    if (limit) {
      q = q.limit(limit);
    }
    return q as never as Promise<SyncJournal[]>;
  }

  async createSyncJournalEntry(entry: InsertSyncJournal): Promise<SyncJournal> {
    const [n] = await db
      .insert(syncJournal)
      .values(entry as never)
      .returning();
    return n as never as SyncJournal;
  }

  async updateSyncJournalEntry(
    id: string,
    updates: Partial<InsertSyncJournal>
  ): Promise<SyncJournal> {
    const [u] = await db
      .update(syncJournal)
      .set({ ...(updates as Record<string, unknown>), updatedAt: new Date() } as never)
      .where(eq(syncJournal.id, id))
      .returning();
    if (!u) {
      throw new Error(`Sync journal entry ${id} not found`);
    }
    return u as never as SyncJournal;
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
    const sortedEntries =
      entries.length > 0
        ? entries.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        : [];
    const lastSync = sortedEntries[0]?.createdAt ?? null;
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
    let q = db.select().from(syncOutbox).$dynamic();
    if (c.length > 0) {
      q = q.where(and(...c));
    }
    return q.orderBy(syncOutbox.priority, syncOutbox.createdAt) as never as Promise<SyncOutbox[]>;
  }

  async createSyncOutboxItem(item: InsertSyncOutbox): Promise<SyncOutbox> {
    const [n] = await db
      .insert(syncOutbox)
      .values(item as never)
      .returning();
    return n as never as SyncOutbox;
  }

  async updateSyncOutboxItem(id: string, updates: Partial<InsertSyncOutbox>): Promise<SyncOutbox> {
    const [u] = await db
      .update(syncOutbox)
      .set({ ...(updates as Record<string, unknown>), updatedAt: new Date() } as never)
      .where(eq(syncOutbox.id, id))
      .returning();
    if (!u) {
      throw new Error(`Sync outbox item ${id} not found`);
    }
    return u as never as SyncOutbox;
  }

  async deleteSyncOutboxItem(id: string): Promise<void> {
    await db.delete(syncOutbox).where(eq(syncOutbox.id, id));
  }

  async getPendingOutboxItems(vesselId: string, limit?: number): Promise<SyncOutbox[]> {
    let q = db
      .select()
      .from(syncOutbox)
      .where(and(eq(syncOutbox.vesselId, vesselId), eq(syncOutbox.status, "pending")))
      .orderBy(syncOutbox.priority, syncOutbox.createdAt)
      .$dynamic();
    if (limit) {
      q = q.limit(limit);
    }
    return q as never as Promise<SyncOutbox[]>;
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
      } as never)
      .where(sql`${syncOutbox.id} = ANY(${idsArray})`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Device Registry
  // ──────────────────────────────────────────────────────────────────────

  async getDeviceRegistry(deviceId: string, orgId: string): Promise<DeviceRegistry | undefined> {
    const [r] = await db
      .select()
      .from(deviceRegistry)
      .where(and(eq(deviceRegistry.id, deviceId), eq(deviceRegistry.orgId, orgId)))
      .limit(1);
    return r;
  }

  async upsertDeviceRegistry(data: InsertDeviceRegistry): Promise<DeviceRegistry> {
    const [r] = await db
      .insert(deviceRegistry)
      .values(data)
      .onConflictDoUpdate({
        target: deviceRegistry.id,
        set: data,
      })
      .returning();
    if (!r) {
      throw new Error("upsertDeviceRegistry: returned no row");
    }
    return r;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Replay Requests
  // ──────────────────────────────────────────────────────────────────────

  async getReplayRequests(deviceId: string, _status?: string): Promise<ReplayIncoming[]> {
    return db
      .select()
      .from(replayIncoming)
      .where(eq(replayIncoming.deviceId, deviceId))
      .orderBy(desc(replayIncoming.receivedAt));
  }

  async createReplayRequest(data: InsertReplayIncoming): Promise<ReplayIncoming> {
    const [r] = await db.insert(replayIncoming).values(data).returning();
    if (!r) {
      throw new Error("createReplayRequest: returned no row");
    }
    return r;
  }

  async updateReplayRequest(
    id: string,
    updates: Partial<InsertReplayIncoming>
  ): Promise<ReplayIncoming> {
    const [r] = await db
      .update(replayIncoming)
      .set({ ...updates })
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
    const key = `${sheetType}:${sheetId}`;
    const [r] = await db.select().from(sheetLock).where(eq(sheetLock.sheetKey, key)).limit(1);
    return r;
  }

  async acquireSheetLock(data: InsertSheetLock): Promise<SheetLock> {
    const [r] = await db
      .insert(sheetLock)
      .values(data)
      .onConflictDoUpdate({
        target: sheetLock.sheetKey,
        set: data,
      })
      .returning();
    if (!r) {
      throw new Error("acquireSheetLock: returned no row");
    }
    return r;
  }

  async releaseSheetLock(sheetType: string, sheetId: string): Promise<void> {
    const key = `${sheetType}:${sheetId}`;
    await db.delete(sheetLock).where(eq(sheetLock.sheetKey, key));
  }

  // ──────────────────────────────────────────────────────────────────────
  // Sheet Version
  // ──────────────────────────────────────────────────────────────────────

  async getSheetVersion(sheetType: string, sheetId: string): Promise<SheetVersion | undefined> {
    const key = `${sheetType}:${sheetId}`;
    const [r] = await db.select().from(sheetVersion).where(eq(sheetVersion.sheetKey, key)).limit(1);
    return r;
  }

  async incrementSheetVersion(data: InsertSheetVersion): Promise<SheetVersion> {
    const d = data as {
      sheetType?: string;
      sheetId?: string;
      sheetKey?: string;
      lastModifiedBy?: string;
    };
    const sheetType: string = d.sheetType ?? "";
    const sheetId: string = d.sheetId ?? "";
    const key: string = d.sheetKey ?? `${sheetType}:${sheetId}`;
    const existing = await db
      .select()
      .from(sheetVersion)
      .where(eq(sheetVersion.sheetKey, key))
      .limit(1);
    const existingRow = existing[0];
    if (existingRow) {
      const [r] = await db
        .update(sheetVersion)
        .set({
          version: (existingRow.version ?? 0) + 1,
          lastModifiedBy: d.lastModifiedBy,
        } as never)
        .where(eq(sheetVersion.sheetKey, key))
        .returning();
      if (!r) {
        throw new Error("incrementSheetVersion: update returned no row");
      }
      return r;
    }
    const [r] = await db
      .insert(sheetVersion)
      .values({ ...data, sheetKey: key, version: 1 } as never)
      .returning();
    if (!r) {
      throw new Error("incrementSheetVersion: insert returned no row");
    }
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
      // The devices table stores its vessel association in the `vessel`
      // column (text). A previous untyped accessor referenced a non-
      // existent `vesselId` column, so this filter silently produced an
      // invalid query whenever a vesselId was supplied.
      c.push(eq(devices.vessel, vesselId));
    }
    const q =
      c.length > 0
        ? db
            .select()
            .from(devices)
            .where(and(...c))
        : db.select().from(devices);
    // Order by `label` — the human-readable device name column.
    return q.orderBy(devices.label);
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const [r] = await db.select().from(devices).where(eq(devices.id, id));
    return r;
  }

  async getDeviceByDeviceId(deviceId: string): Promise<Device | undefined> {
    // SCHEMA GAP: the `devices` table has no `deviceId` column (its primary
    // key is `id`). The previous implementation cast to `any` and queried a
    // non-existent column, which silently returned undefined. This method is
    // currently uncalled. Before wiring it, decide whether:
    //   (a) callers should use getDevice(id) instead, or
    //   (b) a distinct external `device_id` column needs adding via migration.
    // Until then, fail loud rather than silently return undefined.
    throw new Error(
      "getDeviceByDeviceId is not implemented: the devices table has no deviceId column. Use getDevice(id) or add a device_id column."
    );
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const [n] = await db.insert(devices).values(device).returning();
    if (!n) {
      throw new Error("createDevice: returned no row");
    }
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
    // SCHEMA GAP: the `devices` table has neither a `deviceId` column nor a
    // `lastSeenAt` column. The previous implementation cast both to `any`,
    // so this method silently no-op'd / mis-queried. It is currently
    // uncalled. To implement, add a `last_seen_at` column (and decide the
    // device lookup key) via migration, then replace this body.
    throw new Error(
      "updateDeviceLastSeen is not implemented: the devices table has no lastSeenAt/deviceId columns. Add them via migration before wiring."
    );
  }
}
