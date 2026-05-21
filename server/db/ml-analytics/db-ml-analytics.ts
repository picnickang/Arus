/**
 * ML Analytics - Database Storage
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:MlAnalytics:DbMlAnalytics");
import { randomUUID } from "node:crypto";
import { eq, and, desc, sql, gte, lte, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { tableColumns } from "../_helpers/table-columns";
import { db } from "../../db-config";
import { getCloudTableOrUndefined } from "../../utils/cloud-guards";
import {
  mlModels,
  anomalyDetections,
  failurePredictions,
  thresholdOptimizations,
  featureImportances,
  calibrationCurves,
  modelPerformanceValidations,
  engineerOverrides,
  failureHistory,
} from "@shared/schema-runtime";
import type {
  MlModel,
  InsertMlModel,
  AnomalyDetection,
  InsertAnomalyDetection,
  FailurePrediction,
  InsertFailurePrediction,
  ThresholdOptimization,
  InsertThresholdOptimization,
  FeatureImportance,
  InsertFeatureImportance,
  CalibrationCurve,
  InsertCalibrationCurve,
  EngineerOverride,
  InsertEngineerOverride,
  FailureHistory,
  InsertFailureHistory,
} from "@shared/schema";
import { projectFailureHistory } from "../../graph/projector";
import { rulModels } from "@shared/schema-runtime";
import type { RulModel, InsertRulModel } from "@shared/schema";

function jsonSet(column: AnyPgColumn | SQL, path: string, value: string) {
  return sql`jsonb_set(COALESCE(${column}, '{}'::jsonb), '${sql.raw(path)}', ${JSON.stringify(value)}::jsonb)`;
}

export class DatabaseMlAnalyticsStorage {
  async getMlModels(orgId: string, modelType?: string, status?: string): Promise<MlModel[]> {
    const c = [eq(mlModels.orgId, orgId)];
    if (modelType) {
      c.push(eq(mlModels.type, modelType));
    }
    if (status) {
      c.push(eq(mlModels.status, status));
    }
    return db
      .select()
      .from(mlModels)
      .where(and(...c))
      .orderBy(sql`${mlModels.createdAt} DESC`);
  }
  async getMlModel(id: string, orgId: string): Promise<MlModel | undefined> {
    const r = await db
      .select()
      .from(mlModels)
      .where(and(eq(mlModels.id, id), eq(mlModels.orgId, orgId)));
    return r[0];
  }
  async createMlModel(model: InsertMlModel, orgId: string): Promise<MlModel> {
    const [n] = await db
      .insert(mlModels)
      .values({ ...model, orgId, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return n;
  }
  async updateMlModel(
    id: string,
    updates: Partial<InsertMlModel>,
    orgId: string
  ): Promise<MlModel> {
    const [u] = await db
      .update(mlModels)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(mlModels.id, id), eq(mlModels.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`ML Model ${id} not found or access denied`);
    }
    return u;
  }
  async deleteMlModel(id: string, orgId: string): Promise<void> {
    const r = await db
      .delete(mlModels)
      .where(and(eq(mlModels.id, id), eq(mlModels.orgId, orgId)))
      .returning();
    if (r.length === 0) {
      throw new Error(`ML Model ${id} not found or access denied`);
    }
  }

  async getAnomalyDetections(
    orgId: string,
    equipmentId?: string,
    severity?: string
  ): Promise<AnomalyDetection[]> {
    const c = [eq(anomalyDetections.orgId, orgId)];
    if (equipmentId) {
      c.push(eq(anomalyDetections.equipmentId, equipmentId));
    }
    if (severity) {
      c.push(eq(anomalyDetections.severity, severity));
    }
    return db
      .select()
      .from(anomalyDetections)
      .where(and(...c))
      .orderBy(sql`${anomalyDetections.detectionTimestamp} DESC`);
  }
  async getAnomalyDetection(id: number, orgId: string): Promise<AnomalyDetection | undefined> {
    const r = await db
      .select()
      .from(anomalyDetections)
      .where(and(eq(anomalyDetections.id, id), eq(anomalyDetections.orgId, orgId)));
    return r[0];
  }
  async createAnomalyDetection(
    detection: InsertAnomalyDetection,
    orgId: string
  ): Promise<AnomalyDetection> {
    const [n] = await db
      .insert(anomalyDetections)
      .values({ ...detection, orgId, detectionTimestamp: new Date() })
      .returning();
    if (detection.modelId && detection.equipmentId) {
      const d = detection as InsertAnomalyDetection & {
        value?: unknown;
        expectedRange?: unknown;
        modelVersionId?: string;
      };
      try {
        await db
          .insert(modelPerformanceValidations)
          .values({
            orgId,
            modelId: detection.modelId,
            equipmentId: detection.equipmentId,
            predictionId: n.id,
            predictionType: "anomaly_detection",
            predictionTimestamp: n.detectionTimestamp,
            predictedOutcome: {
              anomalyScore: detection.anomalyScore,
              severity: detection.severity,
              sensorType: detection.sensorType,
              value: d.value,
              expectedRange: d.expectedRange,
            },
            modelVersion: d.modelVersionId,
          } as never);
      } catch (e) {
        logger.error(`[ML] Failed to create performance validation:`, undefined, e);
      }
    }
    return n;
  }
  async acknowledgeAnomaly(
    id: number,
    acknowledgedBy: string,
    orgId: string
  ): Promise<AnomalyDetection> {
    const [u] = await db
      .update(anomalyDetections)
      .set({ acknowledgedBy, acknowledgedAt: new Date() })
      .where(and(eq(anomalyDetections.id, id), eq(anomalyDetections.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Anomaly detection ${id} not found or access denied`);
    }
    return u;
  }

  async getFailurePredictions(
    orgId: string,
    equipmentId?: string,
    riskLevel?: string
  ): Promise<FailurePrediction[]> {
    const c = [eq(failurePredictions.orgId, orgId)];
    if (equipmentId) {
      c.push(eq(failurePredictions.equipmentId, equipmentId));
    }
    if (riskLevel) {
      c.push(eq(failurePredictions.riskLevel, riskLevel));
    }
    return db
      .select()
      .from(failurePredictions)
      .where(and(...c))
      .orderBy(sql`${failurePredictions.predictionTimestamp} DESC`);
  }
  async getFailurePrediction(id: number, orgId: string): Promise<FailurePrediction | undefined> {
    const r = await db
      .select()
      .from(failurePredictions)
      .where(and(eq(failurePredictions.id, id), eq(failurePredictions.orgId, orgId)));
    return r[0];
  }
  async createFailurePrediction(
    prediction: InsertFailurePrediction,
    orgId: string
  ): Promise<FailurePrediction> {
    const [n] = await db
      .insert(failurePredictions)
      .values({ ...prediction, orgId, predictionTimestamp: new Date() })
      .returning();
    if (prediction.modelId && prediction.equipmentId) {
      const p = prediction as InsertFailurePrediction & {
        predictedDate?: Date | string;
        severity?: string;
        remainingDays?: number;
      };
      try {
        await db
          .insert(modelPerformanceValidations)
          .values({
            orgId,
            modelId: prediction.modelId,
            equipmentId: prediction.equipmentId,
            predictionId: n.id,
            predictionType: "failure_prediction",
            predictionTimestamp: n.predictionTimestamp ?? new Date(),
            predictedOutcome: {
              failureProbability: prediction.failureProbability,
              predictedDate: p.predictedDate,
              severity: p.severity,
              riskLevel: prediction.riskLevel,
              remainingDays: p.remainingDays,
            },
            modelVersion: prediction.modelVersionId,
          });
      } catch (e) {
        logger.error(`[ML] Failed to create performance validation:`, undefined, e);
      }
    }
    return n;
  }

  /**
   * Task #81 — Canonical write path for failure_history.
   *
   * Inserts the relational row, then best-effort projects it into the
   * knowledge graph after commit. A graph failure MUST NEVER fail the
   * underlying relational write (matches the equipment/inventory
   * pattern in db-equipment / db/inventory). Idempotency is preserved
   * by the projector keying every counting edge on `fh:<id>`.
   */
  async createFailureHistory(
    data: InsertFailureHistory,
    orgId: string
  ): Promise<FailureHistory> {
    const [row] = await db
      .insert(failureHistory)
      .values({ ...data, orgId, createdAt: new Date() } as never)
      .returning();
    try {
      await projectFailureHistory(orgId, {
        failureHistoryId: row.id,
        equipmentId: row.equipmentId,
        failureMode: row.failureMode,
        technicianId: row.verifiedBy ?? null,
        workOrderId: row.workOrderId ?? null,
      });
    } catch (err) {
      logger.warn(`[Graph] projectFailureHistory(${row.id}) failed`, {
        orgId,
        equipmentId: row.equipmentId,
        details: err instanceof Error ? err.message : String(err),
      });
    }
    return row;
  }

  async getThresholdOptimizations(
    orgId: string,
    equipmentId?: string,
    sensorType?: string
  ): Promise<ThresholdOptimization[]> {
    const c = [eq(thresholdOptimizations.orgId, orgId)];
    if (equipmentId) {
      c.push(eq(thresholdOptimizations.equipmentId, equipmentId));
    }
    if (sensorType) {
      c.push(eq(thresholdOptimizations.sensorType, sensorType));
    }
    return db
      .select()
      .from(thresholdOptimizations)
      .where(and(...c))
      .orderBy(sql`${thresholdOptimizations.optimizationTimestamp} DESC`);
  }
  async getThresholdOptimization(
    id: number,
    orgId: string
  ): Promise<ThresholdOptimization | undefined> {
    const r = await db
      .select()
      .from(thresholdOptimizations)
      .where(and(eq(thresholdOptimizations.id, id), eq(thresholdOptimizations.orgId, orgId)));
    return r[0];
  }
  async createThresholdOptimization(
    optimization: InsertThresholdOptimization,
    orgId: string
  ): Promise<ThresholdOptimization> {
    const [n] = await db
      .insert(thresholdOptimizations)
      .values({ ...optimization, orgId, optimizationTimestamp: new Date() })
      .returning();
    return n;
  }
  async applyThresholdOptimization(id: number, orgId: string): Promise<ThresholdOptimization> {
    const [u] = await db
      .update(thresholdOptimizations)
      .set({ appliedAt: new Date(), status: "applied" })
      .where(and(eq(thresholdOptimizations.id, id), eq(thresholdOptimizations.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Threshold optimization ${id} not found or access denied`);
    }
    return u;
  }
  async rejectThresholdOptimization(
    id: number,
    reason: string,
    orgId: string
  ): Promise<ThresholdOptimization> {
    const [u] = await db
      .update(thresholdOptimizations)
      .set({
        status: "rejected",
        metadata: jsonSet(thresholdOptimizations.metadata, "{rejection_reason}", reason),
      })
      .where(and(eq(thresholdOptimizations.id, id), eq(thresholdOptimizations.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Threshold optimization ${id} not found or access denied`);
    }
    return u;
  }

  async createFeatureImportance(importance: InsertFeatureImportance): Promise<FeatureImportance> {
    const table = getCloudTableOrUndefined(featureImportances);
    if (!table) {
      throw new Error("Feature importances are not available in vessel mode");
    }
    const [n] = await db
      .insert(table)
      .values({ ...importance, calculatedAt: new Date() })
      .returning();
    return n;
  }
  async getFeatureImportancesByPrediction(
    orgId: string,
    predictionId: number,
    predictionType: "real_time" | "batch" | "anomaly"
  ): Promise<FeatureImportance[]> {
    const table = getCloudTableOrUndefined(featureImportances);
    if (!table) {
      return [];
    }
    const c = [eq(table.orgId, orgId)];
    if (predictionType === "real_time") {
      c.push(eq(table.realTimePredictionId, predictionId));
    } else if (predictionType === "batch") {
      c.push(eq(table.failurePredictionId, predictionId));
    } else if (predictionType === "anomaly") {
      c.push(eq(table.anomalyDetectionId, predictionId));
    }
    return db
      .select()
      .from(table)
      .where(and(...c))
      .orderBy(sql`${table.calculatedAt} DESC`);
  }
  async getFeatureImportancesByEquipment(
    orgId: string,
    equipmentId: string,
    limit: number = 50
  ): Promise<FeatureImportance[]> {
    const table = getCloudTableOrUndefined(featureImportances);
    if (!table) {
      return [];
    }
    return db
      .select()
      .from(table)
      .where(and(eq(table.orgId, orgId), eq(table.equipmentId, equipmentId)))
      .orderBy(sql`${table.calculatedAt} DESC`)
      .limit(limit);
  }
  async getFeatureImportanceById(
    id: number,
    orgId: string
  ): Promise<FeatureImportance | undefined> {
    const table = getCloudTableOrUndefined(featureImportances);
    if (!table) {
      return undefined;
    }
    const r = await db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.orgId, orgId)));
    return r[0];
  }

  async getCalibrationCurves(
    orgId: string,
    modelId?: string,
    equipmentId?: string,
    status?: string
  ): Promise<CalibrationCurve[]> {
    const table = getCloudTableOrUndefined(calibrationCurves);
    if (!table) {
      return [];
    }
    const tCols = tableColumns(table);
    const c = [eq(table.orgId, orgId)];
    if (modelId) {
      const col = tCols.modelId ?? tCols.modelType;
      if (col) {
        c.push(eq(col, modelId));
      }
    }
    if (equipmentId) {
      const col = tCols.equipmentId ?? tCols.equipmentType;
      if (col) {
        c.push(eq(col, equipmentId));
      }
    }
    if (status) {
      c.push(eq(table.status, status));
    }
    return db
      .select()
      .from(table)
      .where(and(...c))
      .orderBy(sql`${table.createdAt} DESC`);
  }
  async getCalibrationCurve(id: string, orgId: string): Promise<CalibrationCurve | undefined> {
    const table = getCloudTableOrUndefined(calibrationCurves);
    if (!table) {
      return undefined;
    }
    const r = await db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.orgId, orgId)));
    return r[0];
  }
  async createCalibrationCurve(
    curve: InsertCalibrationCurve,
    orgId: string
  ): Promise<CalibrationCurve> {
    const table = getCloudTableOrUndefined(calibrationCurves);
    if (!table) {
      throw new Error("Calibration curves are not available in vessel mode");
    }
    const [n] = await db
      .insert(table)
      .values({ ...curve, orgId, createdAt: new Date() })
      .returning();
    return n;
  }
  async updateCalibrationCurve(
    id: string,
    updates: Partial<InsertCalibrationCurve>,
    orgId: string
  ): Promise<CalibrationCurve> {
    const [u] = await db
      .update(calibrationCurves)
      .set(updates)
      .where(and(eq(calibrationCurves.id, id), eq(calibrationCurves.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Calibration Curve ${id} not found or access denied`);
    }
    return u;
  }
  async deprecateCalibrationCurve(id: string, orgId: string): Promise<CalibrationCurve> {
    return this.updateCalibrationCurve(id, { status: "deprecated" }, orgId);
  }

  async getEngineerOverrides(
    orgId: string,
    filters?: {
      equipmentId?: string;
      engineerId?: string;
      overrideType?: string;
      outcomeStatus?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<EngineerOverride[]> {
    const table = getCloudTableOrUndefined(engineerOverrides);
    if (!table) {
      return [];
    }
    const c = [eq(table.orgId, orgId)];
    if (filters?.equipmentId) {
      c.push(eq(table.equipmentId, filters.equipmentId));
    }
    if (filters?.engineerId) {
      c.push(eq(table.engineerId, filters.engineerId));
    }
    if (filters?.overrideType) {
      c.push(eq(table.overrideType, filters.overrideType));
    }
    if (filters?.outcomeStatus) {
      c.push(eq(table.outcomeStatus, filters.outcomeStatus));
    }
    if (filters?.fromDate) {
      c.push(gte(table.createdAt, filters.fromDate));
    }
    if (filters?.toDate) {
      c.push(lte(table.createdAt, filters.toDate));
    }
    return db
      .select()
      .from(table)
      .where(and(...c))
      .orderBy(sql`${table.createdAt} DESC`);
  }
  async createEngineerOverride(
    override: InsertEngineerOverride,
    orgId: string
  ): Promise<EngineerOverride> {
    const table = getCloudTableOrUndefined(engineerOverrides);
    if (!table) {
      throw new Error("Engineer overrides are not available in vessel mode");
    }
    const [n] = await db
      .insert(table)
      .values({ ...override, orgId, id: randomUUID(), createdAt: new Date() })
      .returning();
    return n;
  }
  async updateEngineerOverride(
    id: string,
    updates: Partial<InsertEngineerOverride>,
    orgId: string
  ): Promise<EngineerOverride> {
    const [u] = await db
      .update(engineerOverrides)
      .set({ ...updates } as never)
      .where(and(eq(engineerOverrides.id, id), eq(engineerOverrides.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Engineer Override ${id} not found or access denied`);
    }
    return u;
  }
  async deleteEngineerOverride(id: string, orgId: string): Promise<void> {
    await db
      .delete(engineerOverrides)
      .where(and(eq(engineerOverrides.id, id), eq(engineerOverrides.orgId, orgId)));
  }
  async expireEngineerOverride(
    id: string,
    expiredBy: string,
    orgId: string
  ): Promise<EngineerOverride> {
    return this.updateEngineerOverride(
      id,
      { status: "expired", expiredBy, expiredAt: new Date() } as Partial<InsertEngineerOverride>,
      orgId
    );
  }

  async getRulModels(orgId?: string): Promise<RulModel[]> {
    const table = getCloudTableOrUndefined(rulModels);
    if (!table) {
      return [];
    }
    if (orgId) {
      return db.select().from(table).where(eq(table.orgId, orgId)).orderBy(desc(table.createdAt));
    }
    return db.select().from(table).orderBy(desc(table.createdAt));
  }
  async getRulModel(modelId: string, orgId?: string): Promise<RulModel | undefined> {
    const table = getCloudTableOrUndefined(rulModels);
    if (!table) {
      return undefined;
    }
    const conditions = orgId
      ? and(eq(table.modelId, modelId), eq(table.orgId, orgId))
      : eq(table.modelId, modelId);
    const [r] = await db.select().from(table).where(conditions);
    return r;
  }
  async createRulModel(model: InsertRulModel): Promise<RulModel> {
    const table = getCloudTableOrUndefined(rulModels);
    if (!table) {
      throw new Error("RUL models are not available in vessel mode");
    }
    const [n] = await db
      .insert(table)
      .values({ ...model, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return n;
  }
}
