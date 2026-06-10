/**
 * Infrastructure: deployed-model lookup for the model-backed inference runner.
 * Holds the raw db read so the runner depends on this repository rather than
 * the db handle directly (hexagonal storage boundary). Query unchanged.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import { mlModels } from "@shared/schema-runtime";

export interface DeployedModelRow {
  id: string;
  status: string;
  metrics: unknown;
}

export async function findDeployedModelById(
  orgId: string,
  modelVersionId: string
): Promise<DeployedModelRow | undefined> {
  const [row] = await db
    .select({
      id: mlModels.id,
      status: mlModels.status,
      metrics: mlModels.trainingMetrics,
    })
    .from(mlModels)
    .where(
      and(
        eq(mlModels.id, modelVersionId),
        eq(mlModels.orgId, orgId),
        eq(mlModels.status, "deployed")
      )
    )
    .limit(1);
  return row;
}
