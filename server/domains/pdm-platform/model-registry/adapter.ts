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
import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("PdmPlatform:ModelRegistry");

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
    // LR-3.5 / PdM tenancy hardening: validate that the foreign
    // `modelId` actually belongs to the caller's org BEFORE inserting
    // a new version row. Without this check, a caller in org A who
    // knows (or guesses) a `modelId` from org B could create a
    // modelVersion row carrying `orgId=A, modelId=<B's model>` —
    // poisoning org B's model registry with org A's lineage. The FK
    // is on `modelId` alone, not `(orgId, modelId)`, so DB constraints
    // do not catch this. Fail closed with the same "not found" shape
    // that getModel() uses so the caller cannot probe model existence
    // across orgs.
    const owner = await this.getModel(data.orgId, data.modelId);
    if (!owner) {
      throw new Error(`Model ${data.modelId} not found`);
    }
    const [result] = await db.insert(modelVersions).values(data).returning();
    if (!result) {
      throw new Error("Failed to create model version");
    }
    logger.info("[ModelRegistry] Version created", {
      orgId: data.orgId,
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
    // LR-3.5 / PdM tenancy hardening: validate ownership of BOTH the
    // path `modelId` and the body `modelVersionId` before any write.
    // Without these checks an admin in org A who knows a `modelId`
    // and `modelVersionId` from org B could deploy a cross-tenant
    // model into org A's active routing — at minimum poisoning org A's
    // inference path with org B's lineage, and (because the
    // subsequent UPDATE deprecates by (orgId,modelId,active)) leaving
    // an inconsistent state if `modelId` does not actually live in
    // the caller's org. FK constraints don't help: FKs are on the
    // id alone, not on `(orgId, id)`.
    const owningModel = await this.getModel(orgId, modelId);
    if (!owningModel) {
      throw new Error(`Model ${modelId} not found`);
    }
    const [owningVersion] = await db
      .select()
      .from(modelVersions)
      .where(
        and(
          eq(modelVersions.id, modelVersionId),
          eq(modelVersions.orgId, orgId),
          eq(modelVersions.modelId, modelId)
        )
      );
    if (!owningVersion) {
      throw new Error(`Model version ${modelVersionId} not found`);
    }

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

    if (!result) {
      throw new Error("Failed to create deployment");
    }
    logger.info("[ModelRegistry] Model deployed", {
      orgId,
      modelId,
      modelVersionId,
      deploymentId: result.id,
    });
    return result;
  }

  async rollback(orgId: string, deploymentId: number): Promise<ModelDeployment> {
    // LR-3.5 / PdM tenancy hardening: every read and write must be
    // scoped by `orgId` AS WELL AS `id`. Without the orgId predicate
    // an admin in org A could pass a deploymentId belonging to org B
    // and force-deprecate org B's active deployment (cross-tenant
    // IDOR flagged by architect review). The route layer already
    // sources `orgId` from `req.orgId` via `requireOrgId`, but the
    // adapter must fail closed in its own right rather than trust
    // the caller.
    const [current] = await db
      .select()
      .from(modelDeployments)
      .where(and(eq(modelDeployments.id, deploymentId), eq(modelDeployments.orgId, orgId)));

    if (!current) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    await db
      .update(modelDeployments)
      .set({ deploymentStatus: "deprecated", deprecatedAt: new Date() })
      .where(and(eq(modelDeployments.id, deploymentId), eq(modelDeployments.orgId, orgId)));

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
        .where(and(eq(modelDeployments.id, previous.id), eq(modelDeployments.orgId, orgId)))
        .returning();
      if (!restored) {
        throw new Error("Failed to restore deployment");
      }
      logger.info("[ModelRegistry] Rolled back", {
        orgId,
        deploymentId,
        restoredId: previous.id,
      });
      return restored;
    }

    throw new Error("No previous deployment to rollback to");
  }
}
