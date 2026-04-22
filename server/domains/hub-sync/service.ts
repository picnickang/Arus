import { dbCrewStorage } from "../../repositories";
import { dbOptimizerStorage } from "../../repositories";
import type { InsertOptimizerConfiguration } from "@shared/schema";
import { db } from "../../db-config";
import { replayIncoming } from "@shared/schema-runtime";
import { desc, sql } from "drizzle-orm";

export const hubSyncService = {
  async logReplayRequest(data: Record<string, unknown>) {
    const [result] = await db.insert(replayIncoming).values(data).returning();
    return result;
  },

  async getReplayHistory(deviceId?: string, endpoint?: string) {
    const rows = await db
      .select()
      .from(replayIncoming)
      .orderBy(desc(replayIncoming.createdAt))
      .limit(100);
    if (!deviceId && !endpoint) {
      return rows;
    }
    return rows.filter((row: Record<string, unknown>) => {
      const payload = row.payload as Record<string, unknown> | null;
      if (deviceId && payload?.deviceId !== deviceId) {
        return false;
      }
      if (endpoint && payload?.endpoint !== endpoint) {
        return false;
      }
      return true;
    });
  },

  async acquireSheetLock(sheetKey: string, holder: string, token: string, expiresAt: Date) {
    const existing = await db.execute(
      sql`SELECT sheet_key, holder, token, expires_at, created_at FROM sheet_lock WHERE sheet_key = ${sheetKey} LIMIT 1`
    );
    const existingRow = existing.rows?.[0];
    if (existingRow && new Date(existingRow.expires_at as string) > new Date()) {
      if (existingRow.holder !== holder) {
        throw new Error(`Sheet ${sheetKey} is already locked by ${existingRow.holder}`);
      }
    }
    const result = await db.execute(
      sql`INSERT INTO sheet_lock (sheet_key, holder, token, expires_at, created_at)
          VALUES (${sheetKey}, ${holder}, ${token}, ${expiresAt}, NOW())
          ON CONFLICT (sheet_key) DO UPDATE SET holder = ${holder}, token = ${token}, expires_at = ${expiresAt}, created_at = NOW()
          RETURNING *`
    );
    return result.rows?.[0] ?? { sheetKey, holder, token, expiresAt };
  },

  async releaseSheetLock(sheetKey: string, token: string) {
    const lock = await this.getSheetLock(sheetKey);
    if (lock && lock.token !== token) {
      throw new Error(`Cannot release lock on ${sheetKey}: invalid token`);
    }
    await db.execute(
      sql`DELETE FROM sheet_lock WHERE sheet_key = ${sheetKey} AND token = ${token}`
    );
  },

  async getSheetLock(sheetKey: string) {
    const result = await db.execute(
      sql`SELECT sheet_key, holder, token, expires_at, created_at FROM sheet_lock WHERE sheet_key = ${sheetKey} LIMIT 1`
    );
    return result.rows?.[0] ?? null;
  },

  async isSheetLocked(sheetKey: string) {
    const lock = await this.getSheetLock(sheetKey);
    if (!lock) {
      return false;
    }
    return new Date(lock.expires_at as string) > new Date();
  },

  async getSheetVersion(sheetKey: string) {
    const result = await db.execute(
      sql`SELECT sheet_key, version, last_modified, last_modified_by FROM sheet_version WHERE sheet_key = ${sheetKey} LIMIT 1`
    );
    return result.rows?.[0] ?? null;
  },

  async incrementSheetVersion(sheetKey: string, modifiedBy: string) {
    const existing = await this.getSheetVersion(sheetKey);
    if (existing) {
      const newVersion = (existing.version as number) + 1;
      const result = await db.execute(
        sql`UPDATE sheet_version SET version = ${newVersion}, last_modified = NOW(), last_modified_by = ${modifiedBy}
            WHERE sheet_key = ${sheetKey} RETURNING *`
      );
      return result.rows?.[0];
    }
    const result = await db.execute(
      sql`INSERT INTO sheet_version (sheet_key, version, last_modified, last_modified_by)
          VALUES (${sheetKey}, 1, NOW(), ${modifiedBy}) RETURNING *`
    );
    return result.rows?.[0];
  },

  async setSheetVersion(data: Record<string, unknown>) {
    const sheetKey = (data.sheetId as string) || (data.sheetKey as string);
    const modifiedBy = (data.lastModifiedBy as string) || (data.modifiedBy as string) || "";
    const version = data.version as number | undefined;
    if (version !== undefined) {
      const result = await db.execute(
        sql`INSERT INTO sheet_version (sheet_key, version, last_modified, last_modified_by)
            VALUES (${sheetKey}, ${version}, NOW(), ${modifiedBy})
            ON CONFLICT (sheet_key) DO UPDATE SET version = ${version}, last_modified = NOW(), last_modified_by = ${modifiedBy}
            RETURNING *`
      );
      return result.rows?.[0];
    }
    return this.incrementSheetVersion(sheetKey, modifiedBy);
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

  async runOptimization(
    configId: string,
    equipmentScope?: string[],
    timeHorizon?: number,
    orgId?: string
  ) {
    const configs = await dbOptimizerStorage.getOptimizerConfigurations(orgId);
    const matchedConfig = configs.find((c) => c.id === configId);
    const resolvedOrgId = matchedConfig?.orgId || orgId;
    if (!resolvedOrgId) {
      throw new Error(
        "Cannot determine orgId for optimization run. Provide orgId or use a valid configId."
      );
    }
    return await dbOptimizerStorage.createOptimizationResult({
      configurationId: configId,
      orgId: resolvedOrgId,
      runStatus: "queued",
      equipmentScope: equipmentScope ? JSON.stringify(equipmentScope) : undefined,
      timeHorizon,
    });
  },

  async cancelOptimization(id: string) {
    return dbOptimizerStorage.updateOptimizationResult(id, { runStatus: "cancelled" });
  },

  async applyOptimizationToProduction(id: string) {
    return dbOptimizerStorage.updateOptimizationResult(id, { runStatus: "applied" });
  },

  async getOptimizationResult(id: string) {
    return dbOptimizerStorage.getOptimizationResult(id);
  },

  async deleteOptimizationResult(id: string) {
    return dbOptimizerStorage.deleteOptimizationResult(id);
  },

  async deleteAllOptimizationResults(orgId: string): Promise<number> {
    const existing = await dbOptimizerStorage.getOptimizationResults(orgId);
    const count = existing.length;
    await dbOptimizerStorage.deleteAllOptimizationResults(orgId);
    return count;
  },

  async getShiftTemplates(orgId?: string) {
    return dbCrewStorage.getShiftTemplates(orgId);
  },

  async createShiftTemplate(data: Record<string, unknown>) {
    return dbCrewStorage.createShiftTemplate(data);
  },

  async deleteShiftTemplate(id: string, orgId?: string) {
    return dbCrewStorage.deleteShiftTemplate(id, orgId || "");
  },
};
