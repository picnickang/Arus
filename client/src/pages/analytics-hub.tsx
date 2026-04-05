import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Compass, Activity, Wrench, DollarSign, Shield, Brain, BookOpen, Bot, Zap } from "lucide-react";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

const analyticsItems: GridItem[] = [
  {
    id: "overview",
    label: "Mission Overview",
    icon: Compass,
    description: "Critical alerts",
    load: () => import("@/components/analytics/MissionOverview").then((m) => ({ default: m.MissionOverview })),
    loaderVariant: "cards",
  },
  {
    id: "operations",
    label: "Operations",
    icon: Activity,
    description: "Ops analytics",
    load: () => import("@/components/analytics/OperationsMode").then((m) => ({ default: m.OperationsMode })),
    loaderVariant: "cards",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    description: "Maint insights",
    load: () => import("@/components/analytics/MaintenanceMode").then((m) => ({ default: m.MaintenanceMode })),
    loaderVariant: "cards",
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    description: "Cost analysis",
    load: () => import("@/components/analytics/FinanceMode").then((m) => ({ default: m.FinanceMode })),
    loaderVariant: "cards",
  },
  {
    id: "data-integrity",
    label: "Data Integrity",
    icon: Shield,
    description: "Data quality",
    load: () => import("@/components/analytics/DataIntegrityDashboard").then((m) => ({ default: m.DataIntegrityDashboard })),
    loaderVariant: "cards",
  },
  {
    id: "equipment-intelligence",
    label: "Equipment Intelligence",
    icon: Brain,
    description: "AI health, predictions & recommendations",
    load: () => import("@/pages/equipment-intelligence"),
    loaderVariant: "cards",
    legacyRoutes: ["/equipment-intelligence"],
  },
  {
    id: "knowledge-base",
    label: "Knowledge Base",
    icon: BookOpen,
    description: "Docs & RAG",
    load: () => import("@/pages/knowledge-base"),
    loaderVariant: "cards",
    legacyRoutes: ["/knowledge-base"],
  },
  {
    id: "kb-chat",
    label: "KB Assistant",
    icon: Bot,
    description: "AI-powered knowledge assistant",
    load: () => import("@/pages/kb-chat"),
    loaderVariant: "cards",
    legacyRoutes: ["/kb-chat"],
  },
  {
    id: "optimizer",
    label: "Optimizer",
    icon: Zap,
    description: "Maintenance optimization tools",
    load: () => import("@/pages/optimization-tools"),
    loaderVariant: "cards",
    legacyRoutes: ["/optimization-tools"],
  },
];

export default function AnalyticsHub() {
  return (
    <PermissionGate resource="analytics_dashboard" action="view" fallback={<PagePermissionDenied />}>
      <IconGridLayout
        title="Analytics & Intelligence"
        description="Contextual insights for marine operations"
        items={analyticsItems}
        defaultItemId="overview"
        baseRoute="/analytics"
      />
    </PermissionGate>
  );
}
