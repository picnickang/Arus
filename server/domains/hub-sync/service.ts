import { dbHubSyncStorage, dbCrewStorage } from "../../repositories";
import { dbOptimizerStorage } from "../../repositories";
import type { InsertReplayIncoming, InsertSheetVersion, InsertOptimizerConfiguration } from "@shared/schema";
import { db } from "../../db-config";
import { replayIncoming } from "@shared/schema-runtime";
import { desc } from "drizzle-orm";

export const hubSyncService = {
  async logReplayRequest(data: InsertReplayIncoming) {
    const [result] = await db.insert(replayIncoming).values(data).returning();
    return result;
  },

  async getReplayHistory(_deviceId?: string, _endpoint?: string) {
    return db.select().from(replayIncoming).orderBy(desc(replayIncoming.createdAt)).limit(100);
  },

  async acquireSheetLock(sheetKeyOrData: string | Record<string, unknown>, holder?: string, token?: string, expiresAt?: Date) {
    if (typeof sheetKeyOrData === 'string' && holder !== undefined) {
      return dbHubSyncStorage.acquireSheetLock({ sheetType: sheetKeyOrData, sheetId: sheetKeyOrData, holder, token, expiresAt } as Parameters<typeof dbHubSyncStorage.acquireSheetLock>[0]);
    }
    return dbHubSyncStorage.acquireSheetLock(sheetKeyOrData as Parameters<typeof dbHubSyncStorage.acquireSheetLock>[0]);
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

  async incrementSheetVersion(sheetKeyOrData: string | Record<string, unknown>, modifiedBy?: string) {
    if (typeof sheetKeyOrData === 'string' && modifiedBy !== undefined) {
      return dbHubSyncStorage.incrementSheetVersion({ sheetType: sheetKeyOrData, sheetId: sheetKeyOrData, lastModifiedBy: modifiedBy } as Parameters<typeof dbHubSyncStorage.incrementSheetVersion>[0]);
    }
    return dbHubSyncStorage.incrementSheetVersion(sheetKeyOrData as Parameters<typeof dbHubSyncStorage.incrementSheetVersion>[0]);
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

  async runOptimization(configId: string, equipmentScope?: string[], timeHorizon?: number, orgId?: string) {
    const config = await dbOptimizerStorage.getOptimizerConfigurations(orgId);
    const matchedConfig = config.find(c => c.id === configId);
    const resolvedOrgId = matchedConfig?.orgId || orgId || '';
    const result = await dbOptimizerStorage.createOptimizationResult({
      configurationId: configId,
      orgId: resolvedOrgId,
      runStatus: 'queued',
      equipmentScope: equipmentScope ? JSON.stringify(equipmentScope) : undefined,
      timeHorizon,
    });
    return result;
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
