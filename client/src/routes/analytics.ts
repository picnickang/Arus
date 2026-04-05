import { lazy } from "react";
import { isFeatureEnabled } from "@/lib/feature-flags";

const EquipmentIntelligence = lazy(() => import("@/pages/equipment-intelligence"));
const AnalyticsHub = lazy(() => import("@/pages/analytics-hub"));
const AIHealthDashboard = lazy(() => import("@/pages/ai-health-dashboard"));
const AIStudioPage = lazy(() => import("@/pages/AIStudioPage"));
const MLTrainingPage = lazy(() => import("@/pages/ml-training"));
const KnowledgeBasePage = lazy(() => import("@/pages/knowledge-base"));
const KnowledgeBaseChatPage = lazy(() => import("@/pages/kb-chat"));
const RagAnalyticsDashboard = lazy(() => import("@/features/kb/pages/RagAnalyticsDashboard"));
const AISensorAudits = lazy(() => import("@/pages/ai-sensor-audits"));
const GovernanceDashboard = lazy(() => import("@/pages/governance-dashboard"));
const ScheduledReports = lazy(() => import("@/pages/scheduled-reports"));
const ScheduledReportsSettings = lazy(() => import("@/pages/scheduled-reports-settings"));

const baseRoutes = [
  { path: "/equipment-intelligence", component: EquipmentIntelligence },
  { path: "/analytics", component: AnalyticsHub },
  { path: "/ai-health", component: AIHealthDashboard },
  { path: "/knowledge-base", component: KnowledgeBasePage },
  { path: "/kb-chat", component: KnowledgeBaseChatPage },
  { path: "/kb-analytics", component: RagAnalyticsDashboard },
  { path: "/ai-sensor-audits", component: AISensorAudits },
  { path: "/governance-dashboard", component: GovernanceDashboard },
  { path: "/scheduled-reports", component: ScheduledReports },
  { path: "/scheduled-reports-settings", component: ScheduledReportsSettings },
];

export const analyticsRoutes = isFeatureEnabled('mlAiStudio')
  ? [...baseRoutes, { path: "/ml-ai", component: AIStudioPage }]
  : baseRoutes;
