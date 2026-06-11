import { eq, and, desc, lte, sql } from "drizzle-orm";
import { db } from "../../../db";
import { failurePredictions, modelVersions } from "@shared/schema";
import type { FailurePrediction } from "@shared/schema";
import type {
  IPredictionGovernanceStorage,
  GovernanceListOptions,
  GovernanceDetails,
} from "./ports";

export class PredictionGovernanceAdapter implements IPredictionGovernanceStorage {
  async listByGovernanceStatus(options: GovernanceListOptions): Promise<FailurePrediction[]> {
    const { orgId, reviewStatus, limit = 50, offset = 0 } = options;

    const conditions = [eq(failurePredictions.orgId, orgId)];
    if (reviewStatus) {
      conditions.push(eq(failurePredictions.reviewStatus, reviewStatus));
    }

    return db
      .select()
      .from(failurePredictions)
      .where(and(...conditions))
      .orderBy(desc(failurePredictions.predictionTimestamp))
      .limit(limit)
      .offset(offset);
  }

  async getById(orgId: string, id: number): Promise<GovernanceDetails | null> {
    const [prediction] = await db
      .select()
      .from(failurePredictions)
      .where(and(eq(failurePredictions.id, id), eq(failurePredictions.orgId, orgId)))
      .limit(1);

    if (!prediction) {
      return null;
    }

    let modelVersionInfo = null;
    if (prediction.modelVersionId) {
      const [mv] = await db
        .select({
          version: modelVersions.version,
          modelId: modelVersions.modelId,
          status: modelVersions.status,
        })
        .from(modelVersions)
        .where(eq(modelVersions.id, prediction.modelVersionId))
        .limit(1);
      modelVersionInfo = mv ?? null;
    }

    return { ...prediction, modelVersionInfo };
  }

  async updateReviewStatus(
    orgId: string,
    id: number,
    status: string,
    reviewedBy: string,
    suppressionReason?: string,
    governanceMetadata?: Record<string, unknown>
  ): Promise<FailurePrediction | null> {
    const updateData: Record<string, unknown> = {
      reviewStatus: status,
      reviewedBy,
      reviewedAt: new Date(),
    };

    if (suppressionReason !== undefined) {
      updateData["suppressionReason"] = suppressionReason;
    }

    if (governanceMetadata !== undefined) {
      updateData["governanceMetadata"] = governanceMetadata;
    }

    const [updated] = await db
      .update(failurePredictions)
      .set(updateData)
      .where(and(eq(failurePredictions.id, id), eq(failurePredictions.orgId, orgId)))
      .returning();

    return updated ?? null;
  }

  async expireStale(orgId: string): Promise<number> {
    const now = new Date();
    const result = await db
      .update(failurePredictions)
      .set({ reviewStatus: "expired", reviewedAt: now })
      .where(
        and(
          eq(failurePredictions.orgId, orgId),
          lte(failurePredictions.predictionValidUntil, now),
          sql`${failurePredictions.predictionValidUntil} IS NOT NULL`,
          sql`${failurePredictions.reviewStatus} NOT IN ('expired', 'suppressed')`
        )
      )
      .returning();

    return result.length;
  }
}
