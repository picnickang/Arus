import { lazy } from "react";

const EquipmentIntelligence = lazy(() => import("@/pages/equipment-intelligence"));
const AnalyticsHub = lazy(() => import("@/pages/analytics-hub"));
const AnalyticsOperations = lazy(() => import("@/pages/analytics-operations"));
const AnalyticsMaintenance = lazy(() => import("@/pages/analytics-maintenance"));
const AnalyticsFinance = lazy(() => import("@/pages/analytics-finance"));
const AnalyticsDataIntegrity = lazy(() => import("@/pages/analytics-data-integrity"));
const KnowledgeBasePage = lazy(() => import("@/pages/knowledge-base"));
const RagAnalyticsDashboard = lazy(() =>
  import("@/features/kb/pages/RagAnalyticsDashboard").then(({ RagAnalyticsDashboard }) => ({
    default: RagAnalyticsDashboard,
  }))
);
const ScheduledReports = lazy(() => import("@/pages/scheduled-reports"));
const ScheduledReportsSettings = lazy(() => import("@/pages/scheduled-reports-settings"));
const AIHealthDashboard = lazy(() => import("@/pages/ai-health-dashboard"));
const AISensorAudits = lazy(() => import("@/pages/ai-sensor-audits"));
const AIStudioPage = lazy(() => import("@/pages/AIStudioPage"));
const MLTraining = lazy(() => import("@/pages/ml-training"));

export const analyticsRoutes = [
  { path: "/equipment-intelligence", component: EquipmentIntelligence },
  { path: "/analytics", component: AnalyticsHub },
  { path: "/analytics/operations", component: AnalyticsOperations },
  { path: "/analytics/maintenance", component: AnalyticsMaintenance },
  { path: "/analytics/finance", component: AnalyticsFinance },
  { path: "/analytics/data-integrity", component: AnalyticsDataIntegrity },
  { path: "/knowledge-base", component: KnowledgeBasePage },
  { path: "/kb-analytics", component: RagAnalyticsDashboard },
  // /governance-dashboard is redirect-only (routeMigrations → /logs?tab=compliance);
  // its <Switch> registration here could never match. The page still renders as
  // a tab inside compliance-consolidated.
  { path: "/scheduled-reports", component: ScheduledReports },
  { path: "/scheduled-reports-settings", component: ScheduledReportsSettings },
  { path: "/ai-health", component: AIHealthDashboard },
  { path: "/ai-sensor-audits", component: AISensorAudits },
  { path: "/ai-studio", component: AIStudioPage },
  { path: "/ml-training", component: MLTraining },
];
