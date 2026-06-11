/**
 * Analytics Routes - LLM Costs and Prediction Feedback
 */
import type { Router, Request, Response } from "express";
import { cachedAnalytics, analyticsCacheKeys } from "../../lib/cache";
import {
  predictionExplainabilityResponseSchema,
  featureImportanceListResponseSchema,
  type PredictionFeedbackListResponse,
  type LlmCostListResponse,
} from "../../../shared/analytics-types";
import { db } from "../../db";
import { predictionFeedback, llmCostTracking } from "../../../shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getOrgId, sendValidatedResponse, handleError } from "./helpers.js";

type CachedAnalyticsLoose = <T>(
  key: string,
  loader: () => Promise<unknown>,
  ttlSeconds?: number
) => Promise<T>;
const cachedAnalyticsLoose = cachedAnalytics as object as CachedAnalyticsLoose;

export function mountCostsAndFeedbackRoutes(router: Router) {
  router.get("/prediction-feedback", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) {
        return;
      }
      const { equipmentId } = req.query;
      const cacheKey = analyticsCacheKeys.predictionFeedback(
        orgId,
        equipmentId as string | undefined
      );
      const response = await cachedAnalyticsLoose<PredictionFeedbackListResponse>(
        cacheKey,
        async () => {
          const filters = [eq(predictionFeedback.orgId, orgId)];
          if (equipmentId) {
            filters.push(eq(predictionFeedback.equipmentId, equipmentId as string));
          }
          const results = await db
            .select()
            .from(predictionFeedback)
            .where(and(...filters))
            .orderBy(sql`${predictionFeedback.createdAt} DESC`)
            .limit(100);
          return {
            results,
            metadata: {
              orgId,
              timestamp: new Date(),
              version: "1.0",
              total: results.length,
              page: 1,
              pageSize: Math.max(results.length, 1),
              hasMore: false,
            },
          };
        },
        240
      );
      sendValidatedResponse(res, response, predictionExplainabilityResponseSchema);
    } catch (error) {
      handleError(res, error, "Prediction Feedback");
    }
  });

  router.get("/llm-costs", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) {
        return;
      }
      const { period } = req.query;
      const cacheKey = analyticsCacheKeys.llmCosts(orgId, period as string | undefined);
      const response = await cachedAnalyticsLoose<LlmCostListResponse>(
        cacheKey,
        async () => {
          const filters = [eq(llmCostTracking.orgId, orgId)];
          if (period) {
            const now = new Date();
            const periodOffsets: Record<string, () => Date> = {
              today: () => new Date(now.setHours(0, 0, 0, 0)),
              week: () => new Date(now.setDate(now.getDate() - 7)),
              month: () => new Date(now.setMonth(now.getMonth() - 1)),
            };
            const startDate = (
              periodOffsets[period as string] ?? (() => new Date(now.setDate(now.getDate() - 30)))
            )();
            filters.push(gte(llmCostTracking.createdAt, startDate));
          }
          const results = await db
            .select()
            .from(llmCostTracking)
            .where(and(...filters))
            .orderBy(sql`${llmCostTracking.createdAt} DESC`)
            .limit(100);
          return {
            results,
            metadata: {
              orgId,
              timestamp: new Date(),
              version: "1.0",
              total: results.length,
              page: 1,
              pageSize: Math.max(results.length, 1),
              hasMore: false,
            },
          };
        },
        300
      );
      sendValidatedResponse(res, response, featureImportanceListResponseSchema);
    } catch (error) {
      handleError(res, error, "LLM Costs");
    }
  });
}
