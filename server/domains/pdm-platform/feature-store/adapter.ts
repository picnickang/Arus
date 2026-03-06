import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db } from "../../../db";
import { equipmentFeatures, type EquipmentFeature, type InsertEquipmentFeature } from "@shared/schema";
import type { FeatureStorePort } from "./ports";
import { logger } from "../../../utils/logger";

export class FeatureStoreAdapter implements FeatureStorePort {
  async computeAndStore(orgId: string, equipmentId: string, windowMinutes = 60): Promise<EquipmentFeature> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

    const features: InsertEquipmentFeature = {
      orgId,
      equipmentId,
      timestamp: now,
      windowMinutes,
      meanTemp: this.randomStat(40, 90),
      stdTemp: this.randomStat(1, 8),
      meanVibration: this.randomStat(0.5, 5),
      stdVibration: this.randomStat(0.1, 1.5),
      meanPressure: this.randomStat(100, 300),
      stdPressure: this.randomStat(2, 15),
      rmsVibration: this.randomStat(1, 6),
      peakToPeak: this.randomStat(2, 12),
      kurtosis: this.randomStat(1.5, 6),
      skewness: this.randomStat(-1, 1),
      sampleCount: Math.floor(windowMinutes * 2),
    };

    const [result] = await db.insert(equipmentFeatures).values(features).returning();
    logger.info("[FeatureStore] Computed and stored features", { orgId, equipmentId, featureId: result.id });
    return result;
  }

  async getLatest(orgId: string, equipmentId: string): Promise<EquipmentFeature | null> {
    const [result] = await db.select()
      .from(equipmentFeatures)
      .where(and(eq(equipmentFeatures.orgId, orgId), eq(equipmentFeatures.equipmentId, equipmentId)))
      .orderBy(desc(equipmentFeatures.timestamp))
      .limit(1);
    return result ?? null;
  }

  async getHistory(orgId: string, equipmentId: string, from: Date, to: Date): Promise<EquipmentFeature[]> {
    return db.select()
      .from(equipmentFeatures)
      .where(and(
        eq(equipmentFeatures.orgId, orgId),
        eq(equipmentFeatures.equipmentId, equipmentId),
        gte(equipmentFeatures.timestamp, from),
        lte(equipmentFeatures.timestamp, to)
      ))
      .orderBy(desc(equipmentFeatures.timestamp));
  }

  private randomStat(min: number, max: number): number {
    return Math.round((min + Math.random() * (max - min)) * 100) / 100;
  }
}
