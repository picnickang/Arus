import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { tableColumns } from "../_helpers/table-columns";
import { db } from "../../db-config";
import { getCloudTableOrUndefined } from "../../utils/cloud-guards";
import {
  calibrationCurves,
  engineerOverrides,
  featureImportances,
  rulModels,
} from "@shared/schema-runtime";
import type {
  CalibrationCurve,
  EngineerOverride,
  FeatureImportance,
  InsertCalibrationCurve,
  InsertEngineerOverride,
  InsertFeatureImportance,
  InsertRulModel,
  RulModel,
} from "@shared/schema";

export async function createFeatureImportance(
  importance: InsertFeatureImportance
): Promise<FeatureImportance> {
  const table = getCloudTableOrUndefined(featureImportances);
  if (!table) {
    throw new Error("Feature importances are not available in vessel mode");
  }
  const [n] = await db
    .insert(table)
    .values({ ...importance, calculatedAt: new Date() })
    .returning();
  if (!n) {
    throw new Error("createFeatureImportance: insert returned no row");
  }
  return n;
}

export async function getFeatureImportancesByPrediction(
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

export async function getFeatureImportancesByEquipment(
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

export async function getFeatureImportanceById(
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

export async function getCalibrationCurves(
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
    const col = tCols["modelId"] ?? tCols["modelType"];
    if (col) {
      c.push(eq(col, modelId));
    }
  }
  if (equipmentId) {
    const col = tCols["equipmentId"] ?? tCols["equipmentType"];
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

export async function getCalibrationCurve(
  id: string,
  orgId: string
): Promise<CalibrationCurve | undefined> {
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

export async function createCalibrationCurve(
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
  if (!n) {
    throw new Error("createCalibrationCurve: insert returned no row");
  }
  return n;
}

export async function updateCalibrationCurve(
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

export async function deprecateCalibrationCurve(
  id: string,
  orgId: string
): Promise<CalibrationCurve> {
  return updateCalibrationCurve(id, { status: "deprecated" }, orgId);
}

export async function getEngineerOverrides(
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

export async function createEngineerOverride(
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
  if (!n) {
    throw new Error("createEngineerOverride: insert returned no row");
  }
  return n;
}

export async function updateEngineerOverride(
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

export async function deleteEngineerOverride(id: string, orgId: string): Promise<void> {
  await db
    .delete(engineerOverrides)
    .where(and(eq(engineerOverrides.id, id), eq(engineerOverrides.orgId, orgId)));
}

export async function expireEngineerOverride(
  id: string,
  expiredBy: string,
  orgId: string
): Promise<EngineerOverride> {
  return updateEngineerOverride(
    id,
    { status: "expired", expiredBy, expiredAt: new Date() } as Partial<InsertEngineerOverride>,
    orgId
  );
}

export async function getRulModels(orgId?: string): Promise<RulModel[]> {
  const table = getCloudTableOrUndefined(rulModels);
  if (!table) {
    return [];
  }
  if (orgId) {
    return db.select().from(table).where(eq(table.orgId, orgId)).orderBy(desc(table.createdAt));
  }
  return db.select().from(table).orderBy(desc(table.createdAt));
}

export async function getRulModel(modelId: string, orgId?: string): Promise<RulModel | undefined> {
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

export async function createRulModel(model: InsertRulModel): Promise<RulModel> {
  const table = getCloudTableOrUndefined(rulModels);
  if (!table) {
    throw new Error("RUL models are not available in vessel mode");
  }
  const [n] = await db
    .insert(table)
    .values({ ...model, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  if (!n) {
    throw new Error("createRulModel: insert returned no row");
  }
  return n;
}
