import type { FailurePrediction } from "@shared/schema";

export interface GovernanceListOptions {
  orgId: string;
  reviewStatus?: string;
  limit?: number;
  offset?: number;
}

export interface GovernanceDetails extends FailurePrediction {
  modelVersionInfo?: {
    version: string;
    modelId: string;
    status: string;
  } | null;
}

export interface IPredictionGovernanceStorage {
  listByGovernanceStatus(options: GovernanceListOptions): Promise<FailurePrediction[]>;
  getById(orgId: string, id: number): Promise<FailurePrediction | null>;
  updateReviewStatus(
    orgId: string,
    id: number,
    status: string,
    reviewedBy: string,
    suppressionReason?: string,
    governanceMetadata?: Record<string, unknown>
  ): Promise<FailurePrediction | null>;
  expireStale(orgId: string): Promise<number>;
}
