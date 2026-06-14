/**
 * Composition - Insights Analytics Data Provider
 *
 * The insights routes read insight snapshots/reports owned by the analytics
 * storage area. This adapter lives in the composition layer (outside
 * server/domains/) so the insights domain stays free of cross-domain analytics
 * storage coupling; the port is injected into the insights routes via the
 * domain-router registry (mirrors the sync→inventory seam).
 */

import type { InsightSnapshot, InsightReport } from "@shared/schema";
import { analyticsInsightsAdapter } from "../repositories.js";
import { dbAnalyticsStorage } from "../db/analytics/index.js";

export interface IInsightsAnalyticsPort {
  getInsightSnapshots(orgId?: string, scope?: string): Promise<InsightSnapshot[]>;
  getInsightReports(orgId?: string, scope?: string): Promise<InsightReport[]>;
  getLatestInsightSnapshot(orgId: string, scope: string): Promise<InsightSnapshot | undefined>;
}

export const insightsAnalyticsProvider: IInsightsAnalyticsPort = {
  getInsightSnapshots: (orgId, scope) => analyticsInsightsAdapter.getInsightSnapshots(orgId, scope),
  getInsightReports: (orgId, scope) => analyticsInsightsAdapter.getInsightReports(orgId, scope),
  getLatestInsightSnapshot: (orgId, scope) =>
    dbAnalyticsStorage.getLatestInsightSnapshot(orgId, scope),
};
