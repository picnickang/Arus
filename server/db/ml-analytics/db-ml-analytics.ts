/**
 * ML Analytics - Database Storage
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:MlAnalytics:DbMlAnalytics");
import { eq, and, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "../../db-config";
import {
  mlModels,
  anomalyDetections,
  failurePredictions,
  thresholdOptimizations,
  modelPerformanceValidations,
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
import type { RulModel, InsertRulModel } from "@shared/schema";
import {
  createCalibrationCurve,
  createEngineerOverride,
  createFeatureImportance,
  createRulModel,
  deleteEngineerOverride,
  deprecateCalibrationCurve,
  expireEngineerOverride,
  getCalibrationCurve,
  getCalibrationCurves,
  getEngineerOverrides,
  getFeatureImportanceById,
  getFeatureImportancesByEquipment,
  getFeatureImportancesByPrediction,
  getRulModel,
  getRulModels,
  updateCalibrationCurve,
  updateEngineerOverride,
} from "./db-ml-analytics-cloud.js";

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
    if (!n) {
      throw new Error("createMlModel: insert returned no row");
    }
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
    if (!n) {
      throw new Error("createAnomalyDetection: insert returned no row");
    }
    if (detection.modelId && detection.equipmentId) {
      const d = detection as InsertAnomalyDetection & {
        value?: unknown;
        expectedRange?: unknown;
        modelVersionId?: string;
      };
      try {
        await db.insert(modelPerformanceValidations).values({
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
    if (!n) {
      throw new Error("createFailurePrediction: insert returned no row");
    }
    if (prediction.modelId && prediction.equipmentId) {
      const p = prediction as InsertFailurePrediction & {
        predictedDate?: Date | string;
        severity?: string;
        remainingDays?: number;
      };
      try {
        await db.insert(modelPerformanceValidations).values({
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
  async createFailureHistory(data: InsertFailureHistory, orgId: string): Promise<FailureHistory> {
    const [row] = await db
      .insert(failureHistory)
      .values({ ...data, orgId, createdAt: new Date() } as never)
      .returning();
    if (!row) {
      throw new Error("createFailureHistory: insert returned no row");
    }
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
    if (!n) {
      throw new Error("createThresholdOptimization: insert returned no row");
    }
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
    return createFeatureImportance(importance);
  }
  async getFeatureImportancesByPrediction(
    orgId: string,
    predictionId: number,
    predictionType: "real_time" | "batch" | "anomaly"
  ): Promise<FeatureImportance[]> {
    return getFeatureImportancesByPrediction(orgId, predictionId, predictionType);
  }
  async getFeatureImportancesByEquipment(
    orgId: string,
    equipmentId: string,
    limit: number = 50
  ): Promise<FeatureImportance[]> {
    return getFeatureImportancesByEquipment(orgId, equipmentId, limit);
  }
  async getFeatureImportanceById(
    id: number,
    orgId: string
  ): Promise<FeatureImportance | undefined> {
    return getFeatureImportanceById(id, orgId);
  }

  async getCalibrationCurves(
    orgId: string,
    modelId?: string,
    equipmentId?: string,
    status?: string
  ): Promise<CalibrationCurve[]> {
    return getCalibrationCurves(orgId, modelId, equipmentId, status);
  }
  async getCalibrationCurve(id: string, orgId: string): Promise<CalibrationCurve | undefined> {
    return getCalibrationCurve(id, orgId);
  }
  async createCalibrationCurve(
    curve: InsertCalibrationCurve,
    orgId: string
  ): Promise<CalibrationCurve> {
    return createCalibrationCurve(curve, orgId);
  }
  async updateCalibrationCurve(
    id: string,
    updates: Partial<InsertCalibrationCurve>,
    orgId: string
  ): Promise<CalibrationCurve> {
    return updateCalibrationCurve(id, updates, orgId);
  }
  async deprecateCalibrationCurve(id: string, orgId: string): Promise<CalibrationCurve> {
    return deprecateCalibrationCurve(id, orgId);
  }

  async getEngineerOverrides(
    orgId: string,
    filters?: {
      equipmentId?: string | undefined;
      engineerId?: string | undefined;
      overrideType?: string | undefined;
      outcomeStatus?: string | undefined;
      fromDate?: Date | undefined;
      toDate?: Date | undefined;
    }
  ): Promise<EngineerOverride[]> {
    return getEngineerOverrides(orgId, filters);
  }
  async createEngineerOverride(
    override: InsertEngineerOverride,
    orgId: string
  ): Promise<EngineerOverride> {
    return createEngineerOverride(override, orgId);
  }
  async updateEngineerOverride(
    id: string,
    updates: Partial<InsertEngineerOverride>,
    orgId: string
  ): Promise<EngineerOverride> {
    return updateEngineerOverride(id, updates, orgId);
  }
  async deleteEngineerOverride(id: string, orgId: string): Promise<void> {
    return deleteEngineerOverride(id, orgId);
  }
  async expireEngineerOverride(
    id: string,
    expiredBy: string,
    orgId: string
  ): Promise<EngineerOverride> {
    return expireEngineerOverride(id, expiredBy, orgId);
  }

  async getRulModels(orgId?: string): Promise<RulModel[]> {
    return getRulModels(orgId);
  }
  async getRulModel(modelId: string, orgId?: string): Promise<RulModel | undefined> {
    return getRulModel(modelId, orgId);
  }
  async createRulModel(model: InsertRulModel): Promise<RulModel> {
    return createRulModel(model);
  }
}
