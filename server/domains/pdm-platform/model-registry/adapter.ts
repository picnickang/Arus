// @ts-nocheck
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import {
  mlModels,
  modelVersions,
  modelDeployments,
  type MlModel,
  type ModelVersion,
  type InsertModelVersion,
  type ModelDeployment,
} from "@shared/schema";
import type { ModelRegistryPort } from "./ports";
import { logger } from "../../../utils/logger";

export class ModelRegistryAdapter implements ModelRegistryPort {
  async listModels(orgId: string): Promise<MlModel[]> {
    return db
      .select()
      .from(mlModels)
      .where(eq(mlModels.orgId, orgId))
      .orderBy(desc(mlModels.createdAt));
  }

  async getModel(orgId: string, modelId: string): Promise<MlModel | null> {
    const [result] = await db
      .select()
      .from(mlModels)
      .where(and(eq(mlModels.orgId, orgId), eq(mlModels.id, modelId)));
    return result ?? null;
  }

  async listVersions(orgId: string, modelId: string): Promise<ModelVersion[]> {
    return db
      .select()
      .from(modelVersions)
      .where(and(eq(modelVersions.orgId, orgId), eq(modelVersions.modelId, modelId)))
      .orderBy(desc(modelVersions.createdAt));
  }

  async createVersion(data: InsertModelVersion): Promise<ModelVersion> {
    const [result] = await db.insert(modelVersions).values(data).returning();
    logger.info("[ModelRegistry] Version created", {
      modelId: data.modelId,
      version: data.version,
    });
    return result;
  }

  async getActiveDeployment(orgId: string, modelId: string): Promise<ModelDeployment | null> {
    const [result] = await db
      .select()
      .from(modelDeployments)
      .where(
        and(
          eq(modelDeployments.orgId, orgId),
          eq(modelDeployments.modelId, modelId),
          eq(modelDeployments.deploymentStatus, "active")
        )
      )
      .orderBy(desc(modelDeployments.deployedAt))
      .limit(1);
    return result ?? null;
  }

  async deploy(
    orgId: string,
    modelId: string,
    modelVersionId: string,
    target: string
  ): Promise<ModelDeployment> {
    await db
      .update(modelDeployments)
      .set({ deploymentStatus: "deprecated", deprecatedAt: new Date() })
      .where(
        and(
          eq(modelDeployments.orgId, orgId),
          eq(modelDeployments.modelId, modelId),
          eq(modelDeployments.deploymentStatus, "active")
        )
      );

    const [result] = await db
      .insert(modelDeployments)
      .values({
        orgId,
        modelId,
        modelVersionId,
        deploymentTarget: target,
        deploymentStatus: "active",
        trafficPercentage: 100,
        deployedBy: "system",
      })
      .returning();

    logger.info("[ModelRegistry] Model deployed", {
      orgId,
      modelId,
      modelVersionId,
      deploymentId: result.id,
    });
    return result;
  }

  async rollback(orgId: string, deploymentId: number): Promise<ModelDeployment> {
    const [current] = await db
      .select()
      .from(modelDeployments)
      .where(eq(modelDeployments.id, deploymentId));

    if (!current) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    await db
      .update(modelDeployments)
      .set({ deploymentStatus: "deprecated", deprecatedAt: new Date() })
      .where(eq(modelDeployments.id, deploymentId));

    const [previous] = await db
      .select()
      .from(modelDeployments)
      .where(
        and(
          eq(modelDeployments.orgId, orgId),
          eq(modelDeployments.modelId, current.modelId),
          eq(modelDeployments.deploymentStatus, "deprecated")
        )
      )
      .orderBy(desc(modelDeployments.deprecatedAt))
      .limit(1);

    if (previous) {
      const [restored] = await db
        .update(modelDeployments)
        .set({ deploymentStatus: "active", deprecatedAt: null })
        .where(eq(modelDeployments.id, previous.id))
        .returning();
      logger.info("[ModelRegistry] Rolled back", { deploymentId, restoredId: previous.id });
      return restored;
    }

    throw new Error("No previous deployment to rollback to");
  }
}
