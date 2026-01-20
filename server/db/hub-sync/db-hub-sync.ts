/**
 * Hub Sync - Database Storage
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { syncJournal, syncOutbox, devices, deviceRegistry, replayIncoming, sheetLock, sheetVersion, type Device, type InsertDevice, type SelectDeviceRegistry, type InsertDeviceRegistry, type SelectReplayIncoming, type InsertReplayIncoming, type SelectSheetLock, type InsertSheetLock, type SelectSheetVersion, type InsertSheetVersion } from "@shared/schema-runtime";
import type { SyncJournal, InsertSyncJournal, SyncOutbox, InsertSyncOutbox } from "./types.js";

export class DatabaseHubSyncStorage {
  async getSyncJournalEntries(vesselId?: string, syncType?: string, limit?: number): Promise<SyncJournal[]> { const c = []; if (vesselId) {c.push(eq(syncJournal.vesselId, vesselId));} if (syncType) {c.push(eq(syncJournal.syncType, syncType));} let q = db.select().from(syncJournal); if (c.length > 0) {q = q.where(and(...c)) as any;} q = q.orderBy(sql`${syncJournal.createdAt} DESC`) as any; if (limit) {q = q.limit(limit) as any;} return q; }
  async createSyncJournalEntry(entry: InsertSyncJournal): Promise<SyncJournal> { const [n] = await db.insert(syncJournal).values(entry).returning(); return n; }
  async updateSyncJournalEntry(id: string, updates: Partial<InsertSyncJournal>): Promise<SyncJournal> { const [u] = await db.update(syncJournal).set({ ...updates, updatedAt: new Date() }).where(eq(syncJournal.id, id)).returning(); if (!u) {throw new Error(`Sync journal entry ${id} not found`);} return u; }
  async getSyncJournalStats(vesselId: string): Promise<{ totalEntries: number; successfulSyncs: number; failedSyncs: number; lastSync: Date | null }> { const entries = await db.select().from(syncJournal).where(eq(syncJournal.vesselId, vesselId)); const successful = entries.filter(e => e.status === 'completed').length; const failed = entries.filter(e => e.status === 'failed').length; const lastSync = entries.length > 0 ? entries.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0].createdAt : null; return { totalEntries: entries.length, successfulSyncs: successful, failedSyncs: failed, lastSync }; }

  async getSyncOutboxItems(vesselId?: string, status?: string): Promise<SyncOutbox[]> { const c = []; if (vesselId) {c.push(eq(syncOutbox.vesselId, vesselId));} if (status) {c.push(eq(syncOutbox.status, status));} let q = db.select().from(syncOutbox); if (c.length > 0) {q = q.where(and(...c)) as any;} return q.orderBy(syncOutbox.priority, syncOutbox.createdAt); }
  async createSyncOutboxItem(item: InsertSyncOutbox): Promise<SyncOutbox> { const [n] = await db.insert(syncOutbox).values(item).returning(); return n; }
  async updateSyncOutboxItem(id: string, updates: Partial<InsertSyncOutbox>): Promise<SyncOutbox> { const [u] = await db.update(syncOutbox).set({ ...updates, updatedAt: new Date() }).where(eq(syncOutbox.id, id)).returning(); if (!u) {throw new Error(`Sync outbox item ${id} not found`);} return u; }
  async deleteSyncOutboxItem(id: string): Promise<void> { await db.delete(syncOutbox).where(eq(syncOutbox.id, id)); }
  async getPendingOutboxItems(vesselId: string, limit?: number): Promise<SyncOutbox[]> { let q = db.select().from(syncOutbox).where(and(eq(syncOutbox.vesselId, vesselId), eq(syncOutbox.status, 'pending'))).orderBy(syncOutbox.priority, syncOutbox.createdAt); if (limit) {q = q.limit(limit) as any;} return q; }
  async markOutboxItemsSynced(ids: string[]): Promise<void> { if (ids.length === 0) {return;} await db.update(syncOutbox).set({ status: 'synced', syncedAt: new Date(), updatedAt: new Date() }).where(sql`${syncOutbox.id} = ANY(${ids})`); }

  async getDeviceRegistry(deviceId: string, orgId: string): Promise<SelectDeviceRegistry | undefined> { const [r] = await db.select().from(deviceRegistry).where(and(eq(deviceRegistry.deviceId, deviceId), eq(deviceRegistry.orgId, orgId))).limit(1); return r; }
  async upsertDeviceRegistry(data: InsertDeviceRegistry): Promise<SelectDeviceRegistry> { const [r] = await db.insert(deviceRegistry).values(data).onConflictDoUpdate({ target: [deviceRegistry.deviceId, deviceRegistry.orgId], set: { ...data, lastSyncAt: new Date(), updatedAt: new Date() } }).returning(); return r; }

  async getReplayRequests(deviceId: string, status?: string): Promise<SelectReplayIncoming[]> { const c = [eq(replayIncoming.deviceId, deviceId)]; if (status) {c.push(eq(replayIncoming.status, status));} return db.select().from(replayIncoming).where(and(...c)).orderBy(sql`${replayIncoming.createdAt} DESC`); }
  async createReplayRequest(data: InsertReplayIncoming): Promise<SelectReplayIncoming> { const [r] = await db.insert(replayIncoming).values(data).returning(); return r; }
  async updateReplayRequest(id: string, updates: Partial<InsertReplayIncoming>): Promise<SelectReplayIncoming> { const [r] = await db.update(replayIncoming).set({ ...updates, updatedAt: new Date() }).where(eq(replayIncoming.id, id)).returning(); if (!r) {throw new Error(`Replay request ${id} not found`);} return r; }

  async getSheetLock(sheetType: string, sheetId: string): Promise<SelectSheetLock | undefined> { const [r] = await db.select().from(sheetLock).where(and(eq(sheetLock.sheetType, sheetType), eq(sheetLock.sheetId, sheetId))).limit(1); return r; }
  async acquireSheetLock(data: InsertSheetLock): Promise<SelectSheetLock> { const [r] = await db.insert(sheetLock).values(data).onConflictDoUpdate({ target: [sheetLock.sheetType, sheetLock.sheetId], set: { ...data, updatedAt: new Date() } }).returning(); return r; }
  async releaseSheetLock(sheetType: string, sheetId: string): Promise<void> { await db.delete(sheetLock).where(and(eq(sheetLock.sheetType, sheetType), eq(sheetLock.sheetId, sheetId))); }

  async getSheetVersion(sheetType: string, sheetId: string): Promise<SelectSheetVersion | undefined> { const [r] = await db.select().from(sheetVersion).where(and(eq(sheetVersion.sheetType, sheetType), eq(sheetVersion.sheetId, sheetId))).limit(1); return r; }
  async incrementSheetVersion(data: InsertSheetVersion): Promise<SelectSheetVersion> { const existing = await this.getSheetVersion(data.sheetType, data.sheetId); if (existing) { const [r] = await db.update(sheetVersion).set({ version: existing.version + 1, lastModifiedBy: data.lastModifiedBy, lastModifiedDevice: data.lastModifiedDevice, updatedAt: new Date() }).where(and(eq(sheetVersion.sheetType, data.sheetType), eq(sheetVersion.sheetId, data.sheetId))).returning(); return r; } const [r] = await db.insert(sheetVersion).values({ ...data, version: 1 }).returning(); return r; }

  async getDevices(orgId?: string, vesselId?: string): Promise<Device[]> { const c = []; if (orgId) {c.push(eq(devices.orgId, orgId));} if (vesselId) {c.push(eq(devices.vesselId, vesselId));} let q = db.select().from(devices); if (c.length > 0) {q = q.where(and(...c)) as any;} return q.orderBy(devices.name); }
  async getDevice(id: string): Promise<Device | undefined> { const [r] = await db.select().from(devices).where(eq(devices.id, id)); return r; }
  async getDeviceByDeviceId(deviceId: string): Promise<Device | undefined> { const [r] = await db.select().from(devices).where(eq(devices.deviceId, deviceId)); return r; }
  async createDevice(device: InsertDevice): Promise<Device> { const [n] = await db.insert(devices).values(device).returning(); return n; }
  async updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device> { const [u] = await db.update(devices).set({ ...updates, updatedAt: new Date() }).where(eq(devices.id, id)).returning(); if (!u) {throw new Error(`Device ${id} not found`);} return u; }
  async deleteDevice(id: string): Promise<void> { await db.delete(devices).where(eq(devices.id, id)); }
  async updateDeviceLastSeen(deviceId: string): Promise<void> { await db.update(devices).set({ lastSeenAt: new Date(), updatedAt: new Date() }).where(eq(devices.deviceId, deviceId)); }
}
