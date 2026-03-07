import type { FailurePrediction } from "@shared/schema";
import type { IPredictionGovernanceStorage, GovernanceListOptions, GovernanceDetails } from "./ports";
import { logger } from "../../../utils/logger";

const MODULE = "PredictionGovernance";

export class PredictionGovernanceService {
  constructor(private storage: IPredictionGovernanceStorage) {}

  async listByGovernanceStatus(options: GovernanceListOptions): Promise<FailurePrediction[]> {
    return this.storage.listByGovernanceStatus(options);
  }

  async getGovernanceDetails(orgId: string, id: number): Promise<GovernanceDetails | null> {
    return this.storage.getById(orgId, id);
  }

  async reviewPrediction(orgId: string, id: number, reviewedBy: string): Promise<FailurePrediction | null> {
    const result = await this.storage.updateReviewStatus(orgId, id, "reviewed", reviewedBy);
    if (result) {
      logger.info(MODULE, `Prediction ${id} reviewed by ${reviewedBy}`, { orgId, id, reviewedBy });
    }
    return result;
  }

  async approvePrediction(orgId: string, id: number, reviewedBy: string): Promise<FailurePrediction | null> {
    const result = await this.storage.updateReviewStatus(orgId, id, "approved", reviewedBy);
    if (result) {
      logger.info(MODULE, `Prediction ${id} approved by ${reviewedBy}`, { orgId, id, reviewedBy });
    }
    return result;
  }

  async suppressPrediction(
    orgId: string,
    id: number,
    reviewedBy: string,
    reason: string
  ): Promise<FailurePrediction | null> {
    const result = await this.storage.updateReviewStatus(orgId, id, "suppressed", reviewedBy, reason);
    if (result) {
      logger.info(MODULE, `Prediction ${id} suppressed by ${reviewedBy}: ${reason}`, { orgId, id, reviewedBy, reason });
    }
    return result;
  }

  async expireStale(orgId: string): Promise<{ expiredCount: number }> {
    const expiredCount = await this.storage.expireStale(orgId);
    if (expiredCount > 0) {
      logger.info(MODULE, `Expired ${expiredCount} stale predictions`, { orgId, expiredCount });
    }
    return { expiredCount };
  }
}
