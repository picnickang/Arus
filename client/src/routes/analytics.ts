import { lazy } from "react";

const EquipmentIntelligence = lazy(() => import("@/pages/equipment-intelligence"));
const AnalyticsHub = lazy(() => import("@/pages/analytics-hub"));
const AnalyticsOperations = lazy(() => import("@/pages/analytics-operations"));
const AnalyticsMaintenance = lazy(() => import("@/pages/analytics-maintenance"));
const AnalyticsFinance = lazy(() => import("@/pages/analytics-finance"));
const AnalyticsDataIntegrity = lazy(() => import("@/pages/analytics-data-integrity"));
const KnowledgeBasePage = lazy(() => import("@/pages/knowledge-base"));
const RagAnalyticsDashboard = lazy(() => import("@/features/kb/pages/RagAnalyticsDashboard"));
const GovernanceDashboard = lazy(() => import("@/pages/governance-dashboard"));
const ScheduledReports = lazy(() => import("@/pages/scheduled-reports"));
const ScheduledReportsSettings = lazy(() => import("@/pages/scheduled-reports-settings"));

export const analyticsRoutes = [
  { path: "/equipment-intelligence", component: EquipmentIntelligence },
  { path: "/analytics", component: AnalyticsHub },
  { path: "/analytics/operations", component: AnalyticsOperations },
  { path: "/analytics/maintenance", component: AnalyticsMaintenance },
  { path: "/analytics/finance", component: AnalyticsFinance },
  { path: "/analytics/data-integrity", component: AnalyticsDataIntegrity },
  { path: "/knowledge-base", component: KnowledgeBasePage },
  { path: "/kb-analytics", component: RagAnalyticsDashboard },
  { path: "/governance-dashboard", component: GovernanceDashboard },
  { path: "/scheduled-reports", component: ScheduledReports },
  { path: "/scheduled-reports-settings", component: ScheduledReportsSettings },
];
