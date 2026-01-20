import { storage } from "../../storage";
import type { InsertReplayIncoming, InsertSheetVersion, InsertOptimizerConfiguration } from "@shared/schema";

export const hubSyncService = {
  async logReplayRequest(data: InsertReplayIncoming) {
    return storage.logReplayRequest(data);
  },

  async getReplayHistory(deviceId?: string, endpoint?: string) {
    return storage.getReplayHistory(deviceId, endpoint);
  },

  async acquireSheetLock(sheetKey: string, holder: string, token: string, expiresAt: Date) {
    return storage.acquireSheetLock(sheetKey, holder, token, expiresAt);
  },

  async releaseSheetLock(sheetKey: string, token: string) {
    return storage.releaseSheetLock(sheetKey, token);
  },

  async getSheetLock(sheetKey: string) {
    return storage.getSheetLock(sheetKey);
  },

  async isSheetLocked(sheetKey: string) {
    return storage.isSheetLocked(sheetKey);
  },

  async getSheetVersion(sheetKey: string) {
    return storage.getSheetVersion(sheetKey);
  },

  async incrementSheetVersion(sheetKey: string, modifiedBy: string) {
    return storage.incrementSheetVersion(sheetKey, modifiedBy);
  },

  async setSheetVersion(data: InsertSheetVersion) {
    return storage.setSheetVersion(data);
  },

  async getOptimizerConfigurations(orgId: string) {
    return storage.getOptimizerConfigurations(orgId);
  },

  async createOptimizerConfiguration(data: InsertOptimizerConfiguration) {
    return storage.createOptimizerConfiguration(data);
  },

  async deleteOptimizerConfiguration(id: string) {
    return storage.deleteOptimizerConfiguration(id);
  },

  async getOptimizationResults(orgId: string) {
    return storage.getOptimizationResults(orgId);
  },

  async runOptimization(configId: string, equipmentScope?: string[], timeHorizon?: number) {
    return storage.runOptimization(configId, equipmentScope, timeHorizon);
  },

  async cancelOptimization(id: string) {
    return storage.cancelOptimization(id);
  },

  async applyOptimizationToProduction(id: string) {
    return storage.applyOptimizationToProduction(id);
  },

  async getOptimizationResult(id: string) {
    return storage.getOptimizationResult(id);
  },

  async deleteOptimizationResult(id: string) {
    return storage.deleteOptimizationResult(id);
  },

  async deleteAllOptimizationResults(orgId: string) {
    return storage.deleteAllOptimizationResults(orgId);
  },

  async getShiftTemplates(orgId?: string) {
    return storage.getShiftTemplates(orgId);
  },

  async createShiftTemplate(data: any) {
    return storage.createShiftTemplate(data);
  },

  async deleteShiftTemplate(id: string) {
    return storage.deleteShiftTemplate(id);
  },
};
