import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Gauge, Lightbulb, Activity } from "lucide-react";

const Dashboard = lazy(() => import("./dashboard-improved"));
const ActiveTelemetry = lazy(() => import("./active-telemetry"));
const ActionableInsights = lazy(() => import("./actionable-insights"));

const operationsItems: GridItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Gauge,
    description: "Fleet overview and alerts",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <Dashboard />
      </Suspense>
    ),
    legacyRoutes: ["/dashboard", "/alerts"],
  },
  {
    id: "active-telemetry",
    label: "Active Telemetry",
    icon: Activity,
    description: "Live sensor streams",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ActiveTelemetry />
      </Suspense>
    ),
    legacyRoutes: ["/active-telemetry"],
  },
  {
    id: "insights",
    label: "Actionable Insights",
    icon: Lightbulb,
    description: "AI recommendations",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ActionableInsights />
      </Suspense>
    ),
    legacyRoutes: ["/actionable-insights"],
  },
];

export default function OperationsHub() {
  return (
    <IconGridLayout
      title="Operations"
      description="Dashboard, telemetry, and insights"
      items={operationsItems}
      defaultItemId="dashboard"
      baseRoute="/operations"
    />
  );
}
