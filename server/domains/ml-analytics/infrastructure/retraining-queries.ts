/**
 * Infrastructure: ML retraining / stale-model sweep queries.
 *
 * Holds the raw `db` access used by the retraining + stale-model job
 * processors so those processors depend on this repository rather than the
 * database handle directly (hexagonal storage boundary). Query logic is
 * unchanged — moved verbatim from the processors.
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  mlModels,
  predictionOutcomes,
  equipment,
} from "@shared/schema-runtime";

export async function countEligibleOutcomes(orgId: string, since: Date): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(predictionOutcomes)
    .where(
      and(
        eq(predictionOutcomes.orgId, orgId),
        eq(predictionOutcomes.useForRetraining, true),
        gte(predictionOutcomes.observedAt, since),
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function listOrgsWithOutcomes(): Promise<string[]> {
  const rows = await db
    .select({ orgId: predictionOutcomes.orgId })
    .from(predictionOutcomes)
    .groupBy(predictionOutcomes.orgId);
  return rows.map((r) => r.orgId);
}

export async function listEquipmentTypesForOrg(orgId: string): Promise<string[]> {
  const rows = await db
    .select({ type: equipment.type })
    .from(equipment)
    .where(eq(equipment.orgId, orgId))
    .groupBy(equipment.type);
  return rows.map((r) => r.type).filter((t): t is string => !!t);
}

export interface ModelMetricsRow {
  id: string;
  metrics: unknown;
}

export async function getModelTrainingMetrics(
  orgId: string,
  modelId: string,
): Promise<ModelMetricsRow | undefined> {
  const [row] = await db
    .select({ id: mlModels.id, metrics: mlModels.trainingMetrics })
    .from(mlModels)
    .where(and(eq(mlModels.id, modelId), eq(mlModels.orgId, orgId)))
    .limit(1);
  return row;
}

export async function updateModelTrainingMetrics(
  orgId: string,
  modelId: string,
  metrics: Record<string, unknown>,
): Promise<void> {
  await db
    .update(mlModels)
    .set({ trainingMetrics: metrics })
    .where(and(eq(mlModels.id, modelId), eq(mlModels.orgId, orgId)));
}

export interface StaleModelRow {
  id: string;
  orgId: string;
  equipmentType: string | null;
  deployedOn: Date | null;
}

export async function findStaleDeployedModels(cutoff: Date): Promise<StaleModelRow[]> {
  return db
    .select({
      id: mlModels.id,
      orgId: mlModels.orgId,
      equipmentType: mlModels.equipmentType,
      deployedOn: mlModels.deployedOn,
    })
    .from(mlModels)
    .where(and(eq(mlModels.status, "deployed"), lt(mlModels.deployedOn, cutoff)));
}
