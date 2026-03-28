import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Gauge, Lightbulb, Activity } from "lucide-react";

const operationsItems: GridItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Gauge,
    description: "Fleet overview and alerts",
    load: () => import("./dashboard-improved"),
    loaderVariant: "cards",
    legacyRoutes: ["/dashboard", "/alerts"],
  },
  {
    id: "active-telemetry",
    label: "Active Telemetry",
    icon: Activity,
    description: "Live sensor streams",
    load: () => import("./active-telemetry"),
    loaderVariant: "cards",
    legacyRoutes: ["/active-telemetry"],
  },
  {
    id: "insights",
    label: "Actionable Insights",
    icon: Lightbulb,
    description: "AI recommendations",
    load: () => import("./actionable-insights"),
    loaderVariant: "cards",
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
