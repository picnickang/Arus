import { lazy } from "react";

const EquipmentIntelligence = lazy(() => import("@/pages/equipment-intelligence"));
const AnalyticsHub = lazy(() => import("@/pages/analytics-hub"));
const KnowledgeBasePage = lazy(() => import("@/pages/knowledge-base"));
const KnowledgeBaseChatPage = lazy(() => import("@/pages/kb-chat"));
const RagAnalyticsDashboard = lazy(() => import("@/features/kb/pages/RagAnalyticsDashboard"));
const GovernanceDashboard = lazy(() => import("@/pages/governance-dashboard"));
const ScheduledReports = lazy(() => import("@/pages/scheduled-reports"));
const ScheduledReportsSettings = lazy(() => import("@/pages/scheduled-reports-settings"));

export const analyticsRoutes = [
  { path: "/equipment-intelligence", component: EquipmentIntelligence },
  { path: "/analytics", component: AnalyticsHub },
  { path: "/knowledge-base", component: KnowledgeBasePage },
  { path: "/kb-chat", component: KnowledgeBaseChatPage },
  { path: "/kb-analytics", component: RagAnalyticsDashboard },
  { path: "/governance-dashboard", component: GovernanceDashboard },
  { path: "/scheduled-reports", component: ScheduledReports },
  { path: "/scheduled-reports-settings", component: ScheduledReportsSettings },
];
