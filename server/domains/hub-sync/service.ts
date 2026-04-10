import { dbHubSyncStorage, dbCrewStorage } from "../../repositories";
import { dbOptimizerStorage } from "../../repositories";
import type { InsertReplayIncoming, InsertSheetVersion, InsertOptimizerConfiguration } from "@shared/schema";
import { db } from "../../db-config";
import { replayIncoming } from "@shared/schema-runtime";
import { eq, desc, and } from "drizzle-orm";

export const hubSyncService = {
  async logReplayRequest(data: InsertReplayIncoming) {
    const [result] = await db.insert(replayIncoming).values(data).returning();
    return result;
  },

  async getReplayHistory(deviceId?: string, endpoint?: string) {
    let q = db.select().from(replayIncoming);
    const conditions = [];
    if (deviceId) conditions.push(eq(replayIncoming.deviceId, deviceId));
    if (conditions.length > 0) {
      q = q.where(and(...conditions)) as any;
    }
    return q.orderBy(desc(replayIncoming.createdAt)).limit(100);
  },

  async acquireSheetLock(sheetKeyOrData: any, holder?: string, token?: string, expiresAt?: Date) {
    if (holder !== undefined) {
      return dbHubSyncStorage.acquireSheetLock({ sheetType: sheetKeyOrData, sheetId: sheetKeyOrData, holder, token, expiresAt });
    }
    return dbHubSyncStorage.acquireSheetLock(sheetKeyOrData);
  },

  async releaseSheetLock(sheetType: string, sheetId: string) {
    return dbHubSyncStorage.releaseSheetLock(sheetType, sheetId);
  },

  async getSheetLock(sheetType: string, sheetId?: string) {
    return dbHubSyncStorage.getSheetLock(sheetType, sheetId || '');
  },

  async isSheetLocked(sheetKey: string) {
    const lock = await dbHubSyncStorage.getSheetLock(sheetKey, '');
    return !!lock;
  },

  async getSheetVersion(sheetType: string, sheetId?: string) {
    return dbHubSyncStorage.getSheetVersion(sheetType, sheetId || '');
  },

  async incrementSheetVersion(data: any) {
    return dbHubSyncStorage.incrementSheetVersion(data);
  },

  async setSheetVersion(data: InsertSheetVersion) {
    return dbHubSyncStorage.incrementSheetVersion(data);
  },

  async getOptimizerConfigurations(orgId: string) {
    return dbOptimizerStorage.getOptimizerConfigurations(orgId);
  },

  async createOptimizerConfiguration(data: InsertOptimizerConfiguration) {
    return dbOptimizerStorage.createOptimizerConfiguration(data);
  },

  async deleteOptimizerConfiguration(id: string) {
    return dbOptimizerStorage.deleteOptimizerConfiguration(id);
  },

  async getOptimizationResults(orgId: string) {
    return dbOptimizerStorage.getOptimizationResults(orgId);
  },

  async runOptimization(configId: string, equipmentScope?: string[], timeHorizon?: number) {
    return { id: configId, status: 'queued', equipmentScope, timeHorizon };
  },

  async cancelOptimization(id: string) {
    return dbOptimizerStorage.deleteOptimizationResult(id);
  },

  async applyOptimizationToProduction(id: string) {
    const result = await dbOptimizerStorage.getOptimizationResult(id);
    return result;
  },

  async getOptimizationResult(id: string) {
    return dbOptimizerStorage.getOptimizationResult(id);
  },

  async deleteOptimizationResult(id: string) {
    return dbOptimizerStorage.deleteOptimizationResult(id);
  },

  async deleteAllOptimizationResults(orgId: string) {
    return dbOptimizerStorage.deleteAllOptimizationResults(orgId);
  },

  async getShiftTemplates(orgId?: string) {
    return dbCrewStorage.getShiftTemplates(orgId);
  },

  async createShiftTemplate(data: any) {
    return dbCrewStorage.createShiftTemplate(data);
  },

  async deleteShiftTemplate(id: string, orgId?: string) {
    return dbCrewStorage.deleteShiftTemplate(id, orgId || '');
  },
};
