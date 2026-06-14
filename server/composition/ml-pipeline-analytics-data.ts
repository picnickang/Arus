/**
 * Composition - ML Pipeline Analytics Data Provider
 *
 * The ML-pipeline routes read/write ML and RUL models owned by the ML-analytics
 * storage (mapped to the pdm-platform domain). This adapter lives in the
 * composition layer (outside server/domains/) so the ml-pipeline domain stays
 * free of cross-domain storage coupling; the port is injected via the
 * domain-router registry (mirrors the sync→inventory seam).
 */

import type { MlModel, RulModel, InsertRulModel } from "@shared/schema";
import { dbMlAnalyticsStorage } from "../db/ml-analytics/index.js";

export interface IMlPipelineAnalyticsPort {
  getMlModels(orgId: string, modelType?: string, status?: string): Promise<MlModel[]>;
  getRulModels(orgId?: string): Promise<RulModel[]>;
  getRulModel(modelId: string, orgId?: string): Promise<RulModel | undefined>;
  createRulModel(model: InsertRulModel): Promise<RulModel>;
}

export const mlPipelineAnalyticsProvider: IMlPipelineAnalyticsPort = {
  getMlModels: (orgId, modelType, status) =>
    dbMlAnalyticsStorage.getMlModels(orgId, modelType, status),
  getRulModels: (orgId) => dbMlAnalyticsStorage.getRulModels(orgId),
  getRulModel: (modelId, orgId) => dbMlAnalyticsStorage.getRulModel(modelId, orgId),
  createRulModel: (model) => dbMlAnalyticsStorage.createRulModel(model),
};
