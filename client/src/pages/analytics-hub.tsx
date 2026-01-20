import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Compass, Activity, Wrench, DollarSign, Shield, Brain, BookOpen } from "lucide-react";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

const MissionOverview = lazy(() =>
  import("@/components/analytics/MissionOverview").then((m) => ({ default: m.MissionOverview }))
);
const OperationsMode = lazy(() =>
  import("@/components/analytics/OperationsMode").then((m) => ({ default: m.OperationsMode }))
);
const MaintenanceMode = lazy(() =>
  import("@/components/analytics/MaintenanceMode").then((m) => ({ default: m.MaintenanceMode }))
);
const FinanceMode = lazy(() =>
  import("@/components/analytics/FinanceMode").then((m) => ({ default: m.FinanceMode }))
);
const DataIntegrityDashboard = lazy(() =>
  import("@/components/analytics/DataIntegrityDashboard").then((m) => ({
    default: m.DataIntegrityDashboard,
  }))
);
const AIHealthDashboard = lazy(() => import("@/pages/ai-health-dashboard"));
const KnowledgeBase = lazy(() => import("@/pages/knowledge-base"));

const analyticsItems: GridItem[] = [
  {
    id: "overview",
    label: "Mission Overview",
    icon: Compass,
    description: "Critical alerts",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <MissionOverview />
      </Suspense>
    ),
  },
  {
    id: "operations",
    label: "Operations",
    icon: Activity,
    description: "Ops analytics",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <OperationsMode />
      </Suspense>
    ),
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    description: "Maint insights",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <MaintenanceMode />
      </Suspense>
    ),
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    description: "Cost analysis",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <FinanceMode />
      </Suspense>
    ),
  },
  {
    id: "data-integrity",
    label: "Data Integrity",
    icon: Shield,
    description: "Data quality",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <DataIntegrityDashboard />
      </Suspense>
    ),
  },
  {
    id: "ai-health",
    label: "AI Health",
    icon: Brain,
    description: "AI/ML status",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <AIHealthDashboard />
      </Suspense>
    ),
    legacyRoutes: ["/ai-health"],
  },
  {
    id: "knowledge-base",
    label: "Knowledge Base",
    icon: BookOpen,
    description: "Docs & RAG",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <KnowledgeBase />
      </Suspense>
    ),
    legacyRoutes: ["/knowledge-base"],
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
