/**
 * ML Analytics - ML Model Storage (free functions)
 *
 * Extracted from db-ml-analytics.ts so the class can delegate the mlModels
 * table operations. Behavior is preserved exactly; the DatabaseMlAnalyticsStorage
 * methods are thin wrappers over these functions.
 */

import { eq, and, ne, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { mlModels } from "@shared/schema-runtime";
import type { MlModel, InsertMlModel } from "@shared/schema";

export async function getMlModels(
  orgId: string,
  modelType?: string,
  status?: string
): Promise<MlModel[]> {
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

export async function getMlModel(id: string, orgId: string): Promise<MlModel | undefined> {
  const r = await db
    .select()
    .from(mlModels)
    .where(and(eq(mlModels.id, id), eq(mlModels.orgId, orgId)));
  return r[0];
}

export async function createMlModel(model: InsertMlModel, orgId: string): Promise<MlModel> {
  const [n] = await db
    .insert(mlModels)
    .values({ ...model, orgId, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  if (!n) {
    throw new Error("createMlModel: insert returned no row");
  }
  return n;
}

export async function updateMlModel(
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

/**
 * Atomically promote `candidateId` to the sole deployed model for its
 * equipmentType: in one transaction, archive any other currently-deployed
 * model of that type and mark the candidate deployed. Replaces the previous
 * non-transactional archive-loop-then-promote, which left the equipmentType
 * with zero deployed models if the process failed between the two writes.
 * Returns the promoted row and the ids it replaced.
 */
export async function promoteMlModel(
  candidateId: string,
  equipmentType: string,
  orgId: string
): Promise<{ promoted: MlModel; replaced: string[] }> {
  return db.transaction(async (tx) => {
    const archived = await tx
      .update(mlModels)
      .set({ status: "archived", archivedOn: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(mlModels.orgId, orgId),
          eq(mlModels.equipmentType, equipmentType),
          eq(mlModels.status, "deployed"),
          ne(mlModels.id, candidateId)
        )
      )
      .returning({ id: mlModels.id });
    const [promoted] = await tx
      .update(mlModels)
      .set({
        status: "deployed",
        deployedOn: new Date(),
        archivedOn: null,
        updatedAt: new Date(),
      })
      .where(and(eq(mlModels.id, candidateId), eq(mlModels.orgId, orgId)))
      .returning();
    if (!promoted) {
      throw new Error(`ML Model ${candidateId} not found or access denied`);
    }
    return { promoted, replaced: archived.map((a) => a.id) };
  });
}

/**
 * Atomically roll back a deployed model: in one transaction, archive
 * `currentId` and restore `previousId` to deployed — so there is never a
 * window where neither is the deployed model.
 */
export async function rollbackMlModel(
  currentId: string,
  previousId: string,
  orgId: string
): Promise<MlModel> {
  return db.transaction(async (tx) => {
    await tx
      .update(mlModels)
      .set({ status: "archived", archivedOn: new Date(), updatedAt: new Date() })
      .where(and(eq(mlModels.id, currentId), eq(mlModels.orgId, orgId)));
    const [restored] = await tx
      .update(mlModels)
      .set({
        status: "deployed",
        deployedOn: new Date(),
        archivedOn: null,
        updatedAt: new Date(),
      })
      .where(and(eq(mlModels.id, previousId), eq(mlModels.orgId, orgId)))
      .returning();
    if (!restored) {
      throw new Error(`ML Model ${previousId} not found or access denied`);
    }
    return restored;
  });
}

export async function deleteMlModel(id: string, orgId: string): Promise<void> {
  const r = await db
    .delete(mlModels)
    .where(and(eq(mlModels.id, id), eq(mlModels.orgId, orgId)))
    .returning();
  if (r.length === 0) {
    throw new Error(`ML Model ${id} not found or access denied`);
  }
}
