import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Gauge } from "lucide-react";

const operationsItems: GridItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Gauge,
    description: "Fleet overview, alerts, telemetry & insights",
    load: () => import("./dashboard-improved"),
    loaderVariant: "cards",
    legacyRoutes: ["/dashboard", "/alerts"],
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
