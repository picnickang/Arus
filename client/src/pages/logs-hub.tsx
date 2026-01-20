import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { FileCheck, Anchor, Cog, Activity } from "lucide-react";

const ComplianceConsolidated = lazy(() => import("./compliance-consolidated"));
const DeckLogConsolidated = lazy(() => import("./deck-log-consolidated"));
const EngineLogConsolidated = lazy(() => import("./engine-log-consolidated"));
const EquipmentLogConsolidated = lazy(() => import("./equipment-log-consolidated"));

const logsItems: GridItem[] = [
  {
    id: "compliance",
    label: "Compliance",
    icon: FileCheck,
    description: "Compliance & governance",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ComplianceConsolidated />
      </Suspense>
    ),
    legacyRoutes: ["/logs-compliance", "/governance", "/governance-dashboard"],
  },
  {
    id: "deck",
    label: "Deck Log",
    icon: Anchor,
    description: "Deck logbook & vessel track",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <DeckLogConsolidated />
      </Suspense>
    ),
    legacyRoutes: ["/deck-logbook", "/vessel-track-log"],
  },
  {
    id: "engine",
    label: "Engine Log",
    icon: Cog,
    description: "Engine room & fuel",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <EngineLogConsolidated />
      </Suspense>
    ),
    legacyRoutes: ["/engine-logbook", "/fuel-emissions-log"],
  },
  {
    id: "equipment",
    label: "Equipment Log",
    icon: Activity,
    description: "Condition & decommissioned",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <EquipmentLogConsolidated />
      </Suspense>
    ),
    legacyRoutes: ["/condition-monitoring-log", "/decommissioned-equipment-log"],
  },
];

export default function LogsHub() {
  return (
    <IconGridLayout
      title="Logs & Compliance"
      description="Maritime logbooks and compliance documentation"
      items={logsItems}
      defaultItemId="compliance"
      baseRoute="/logs"
    />
  );
}
