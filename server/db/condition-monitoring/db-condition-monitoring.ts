/**
 * Condition Monitoring - Database Storage (BaseRepository Pattern)
 */

import { eq, and, sql, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { BaseRepository } from "../../shared/base-repository";
import {
  oilAnalysis,
  wearParticleAnalysis,
  conditionMonitoring,
  oilChangeRecords,
  type OilAnalysis,
  type InsertOilAnalysis,
  type WearParticleAnalysis,
  type InsertWearParticleAnalysis,
  type ConditionMonitoring,
  type InsertConditionMonitoring,
  type OilChangeRecord,
  type InsertOilChangeRecord,
} from "@shared/schema";

const oilAnalysisRepo = new BaseRepository<OilAnalysis, InsertOilAnalysis>(oilAnalysis, {
  updatedAtColumn: "updatedAt",
});
const wearParticleRepo = new BaseRepository<WearParticleAnalysis, InsertWearParticleAnalysis>(
  wearParticleAnalysis,
  { updatedAtColumn: "updatedAt" }
);
const conditionMonitoringRepo = new BaseRepository<ConditionMonitoring, InsertConditionMonitoring>(
  conditionMonitoring,
  { updatedAtColumn: "updatedAt" }
);

export class DbConditionMonitoringStorage {
  async getOilAnalyses(orgId?: string, equipmentId?: string): Promise<OilAnalysis[]> {
    if (!orgId) {
      return db
        .select()
        .from(oilAnalysis)
        .orderBy(sql`${oilAnalysis.sampleDate} DESC`);
    }
    const filters = equipmentId ? { equipmentId } : undefined;
    return oilAnalysisRepo.list(orgId, filters);
  }
  async getOilAnalysis(id: string, orgId?: string): Promise<OilAnalysis | undefined> {
    if (orgId) {
      const r = await oilAnalysisRepo.getById(id, orgId);
      return r ?? undefined;
    }
    const result = await db.select().from(oilAnalysis).where(eq(oilAnalysis.id, id)).limit(1);
    return result[0];
  }
  async createOilAnalysis(analysis: InsertOilAnalysis): Promise<OilAnalysis> {
    return oilAnalysisRepo.create({
      ...analysis,
      sampleDate: analysis.sampleDate ? new Date(analysis.sampleDate) : new Date(),
    });
  }
  async updateOilAnalysis(
    id: string,
    analysis: Partial<InsertOilAnalysis>,
    orgId?: string
  ): Promise<OilAnalysis> {
    if (!orgId) {
      throw new Error("orgId required");
    }
    return oilAnalysisRepo.update(id, analysis, orgId);
  }
  async deleteOilAnalysis(id: string, orgId?: string): Promise<void> {
    if (!orgId) {
      throw new Error("orgId required");
    }
    await oilAnalysisRepo.delete(id, orgId);
  }
  async getLatestOilAnalysis(
    equipmentId: string,
    orgId?: string
  ): Promise<OilAnalysis | undefined> {
    const c = [eq(oilAnalysis.equipmentId, equipmentId)];
    if (orgId) {
      c.push(eq(oilAnalysis.orgId, orgId));
    }
    const result = await db
      .select()
      .from(oilAnalysis)
      .where(and(...c))
      .orderBy(sql`${oilAnalysis.sampleDate} DESC`)
      .limit(1);
    return result[0];
  }

  async getWearParticleAnalyses(
    orgId?: string,
    equipmentId?: string
  ): Promise<WearParticleAnalysis[]> {
    if (!orgId) {
      return db
        .select()
        .from(wearParticleAnalysis)
        .orderBy(sql`${wearParticleAnalysis.analysisDate} DESC`);
    }
    const filters = equipmentId ? { equipmentId } : undefined;
    return wearParticleRepo.list(orgId, filters);
  }
  async getWearParticleAnalysis(
    id: string,
    orgId?: string
  ): Promise<WearParticleAnalysis | undefined> {
    if (orgId) {
      const r = await wearParticleRepo.getById(id, orgId);
      return r ?? undefined;
    }
    const result = await db
      .select()
      .from(wearParticleAnalysis)
      .where(eq(wearParticleAnalysis.id, id))
      .limit(1);
    return result[0];
  }
  async createWearParticleAnalysis(
    analysis: InsertWearParticleAnalysis
  ): Promise<WearParticleAnalysis> {
    const data = {
      ...analysis,
      analysisDate: analysis.analysisDate ? new Date(analysis.analysisDate) : new Date(),
    };
    const mutable = data as Record<string, unknown>;
    Object.keys(mutable).forEach((k) => {
      if (mutable[k] === undefined) {
        delete mutable[k];
      }
    });
    return wearParticleRepo.create(data);
  }
  async updateWearParticleAnalysis(
    id: string,
    analysis: Partial<InsertWearParticleAnalysis>,
    orgId?: string
  ): Promise<WearParticleAnalysis> {
    if (!orgId) {
      throw new Error("orgId required");
    }
    return wearParticleRepo.update(id, analysis, orgId);
  }
  async deleteWearParticleAnalysis(id: string, orgId?: string): Promise<void> {
    if (!orgId) {
      throw new Error("orgId required");
    }
    await wearParticleRepo.delete(id, orgId);
  }
  async getLatestWearParticleAnalysis(
    equipmentId: string,
    orgId?: string
  ): Promise<WearParticleAnalysis | undefined> {
    const c = [eq(wearParticleAnalysis.equipmentId, equipmentId)];
    if (orgId) {
      c.push(eq(wearParticleAnalysis.orgId, orgId));
    }
    const result = await db
      .select()
      .from(wearParticleAnalysis)
      .where(and(...c))
      .orderBy(sql`${wearParticleAnalysis.analysisDate} DESC`)
      .limit(1);
    return result[0];
  }

  async getConditionMonitoringRecords(
    orgId?: string,
    equipmentId?: string
  ): Promise<ConditionMonitoring[]> {
    if (!orgId) {
      return db
        .select()
        .from(conditionMonitoring)
        .orderBy(sql`${conditionMonitoring.assessmentDate} DESC`);
    }
    const filters = equipmentId ? { equipmentId } : undefined;
    return conditionMonitoringRepo.list(orgId, filters);
  }
  async getConditionMonitoringRecord(
    id: string,
    orgId?: string
  ): Promise<ConditionMonitoring | undefined> {
    if (orgId) {
      const r = await conditionMonitoringRepo.getById(id, orgId);
      return r ?? undefined;
    }
    const result = await db
      .select()
      .from(conditionMonitoring)
      .where(eq(conditionMonitoring.id, id))
      .limit(1);
    return result[0];
  }
  async createConditionMonitoringRecord(
    record: InsertConditionMonitoring
  ): Promise<ConditionMonitoring> {
    return conditionMonitoringRepo.create(record);
  }
  async updateConditionMonitoringRecord(
    id: string,
    record: Partial<InsertConditionMonitoring>,
    orgId?: string
  ): Promise<ConditionMonitoring> {
    if (!orgId) {
      throw new Error("orgId required");
    }
    return conditionMonitoringRepo.update(id, record, orgId);
  }
  async deleteConditionMonitoringRecord(id: string, orgId?: string): Promise<void> {
    if (!orgId) {
      throw new Error("orgId required");
    }
    await conditionMonitoringRepo.delete(id, orgId);
  }

  async getOilChangeRecords(orgId?: string, equipmentId?: string): Promise<OilChangeRecord[]> {
    const c: SQL[] = [];
    if (orgId) {
      c.push(eq(oilChangeRecords.orgId, orgId));
    }
    if (equipmentId) {
      c.push(eq(oilChangeRecords.equipmentId, equipmentId));
    }
    return db
      .select()
      .from(oilChangeRecords)
      .where(c.length ? and(...c) : undefined)
      .orderBy(sql`${oilChangeRecords.changeDate} DESC`);
  }

  async createOilChangeRecord(record: InsertOilChangeRecord): Promise<OilChangeRecord> {
    const [n] = await db
      .insert(oilChangeRecords)
      .values({
        ...record,
        changeDate: record.changeDate ? new Date(record.changeDate) : new Date(),
      })
      .returning();
    if (!n) {throw new Error("Failed to create oil change record");}
    return n;
  }

  async getLatestOilChangeRecord(
    equipmentId: string,
    orgId?: string
  ): Promise<OilChangeRecord | undefined> {
    const c = [eq(oilChangeRecords.equipmentId, equipmentId)];
    if (orgId) {
      c.push(eq(oilChangeRecords.orgId, orgId));
    }
    const result = await db
      .select()
      .from(oilChangeRecords)
      .where(and(...c))
      .orderBy(sql`${oilChangeRecords.changeDate} DESC`)
      .limit(1);
    return result[0];
  }
}
